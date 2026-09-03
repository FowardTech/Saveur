package com.saveur.app

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Locale
import java.util.UUID

// DuplexVoiceEngineModule -- Android counterpart to ios/caren_family/
// DuplexVoiceEngine.swift. Read that file's own header comment first if
// you haven't -- this module deliberately mirrors its JS-facing contract
// exactly (same method names, same event names/shapes) so
// services/duplexVoiceService.ts needs no per-platform branching beyond
// the isSupportedPlatform check itself; VoiceCoachView.tsx is entirely
// unaware which platform it's talking to.
//
// WHY THIS IS PHASE 1, ON-DEVICE-TTS-ONLY, JUST LIKE THE iOS FILE WAS:
// speakRemoteAudio (the ElevenLabs playback path, JS's speakRemote/
// speakWithFallback) is NOT implemented here yet -- it rejects
// immediately, which speakWithFallback() in duplexVoiceService.ts already
// treats as "fall back to on-device speech", so nothing crashes or hangs;
// it just always uses on-device TTS on Android for now instead of the
// real ElevenLabs voice, same as iOS did before its own Phase 2 landed.
//
// THE ONE ARCHITECTURAL DIFFERENCE FROM iOS THAT MATTERS MOST HERE:
// SFSpeechRecognizer on iOS lets an app own the AVAudioEngine/microphone
// directly and feed it raw PCM buffers -- that's what made a single
// shared engine (mic capture + TTS playback on the SAME graph, with
// explicit voice-processing/AEC) possible there. Android's public
// SpeechRecognizer API does NOT expose that: it owns its OWN internal
// audio capture (typically routed to the device's default recognition
// service, usually Google's), and gives this module no access to its
// underlying AudioRecord session -- so there is no way to explicitly
// attach an AcousticEchoCanceler (or any other AudioEffect) to whatever
// SpeechRecognizer is actually recording from. Echo cancellation here is
// therefore NOT explicitly engineered the way it is on iOS -- it relies
// entirely on the OS/device's own system-level handling of concurrent
// playback+capture, encouraged by setting AudioManager.MODE_IN_COMMUNICATION
// while duplex mode is active (the standard Android signal for "this is a
// VoIP-style concurrent audio scenario," analogous to iOS's
// AVAudioSessionModeVoiceChat). How well that actually suppresses the
// coach hearing its own TTS is expected to vary by device/manufacturer far
// more than the iOS implementation's explicit Voice-Processing I/O unit
// did -- this is the single highest-uncertainty area of this file, worth
// checking first if barge-in echo is reported on a real device.
//
// RESTART-LOOP LESSONS CARRIED OVER FROM THE iOS INVESTIGATION (see that
// file's own extensive comments on recentNoSpeechTimestamps/
// recentRecognitionErrorTimestamps/the 0.25s dispatch fix for the full
// history): SpeechRecognizer sessions end on their own after a period of
// silence or a real result, same as SFSpeechRecognizer's -- "always
// listening" here means catching onError/onResults and starting a fresh
// session, exactly like beginRecognition()'s restart-on-error loop does
// on iOS. Applying those same lessons up front instead of re-discovering
// them the hard way a second time: restarts are always posted with a
// short delay (never called synchronously/inline from inside a listener
// callback, which is exactly what caused a tight, thread-pegging loop on
// iOS), and a give-up guard on repeated "no match"/timeout errors cools
// down rather than restarting instantly forever -- but, having also
// learned THAT the hard way on iOS (a give-up that never restarts again
// leaves the session permanently, silently dead for the rest of the
// visit), the give-up guard here always schedules a LATER retry instead
// of stopping for good.
class DuplexVoiceEngineModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "DuplexVoiceEngine"

  private val mainHandler = Handler(Looper.getMainLooper())
  private var speechRecognizer: SpeechRecognizer? = null
  private var textToSpeech: TextToSpeech? = null
  private var ttsReady = false
  private var isEngineSetUp = false
  private var audioFocusRequest: AudioFocusRequest? = null

  // Bumped on every speak()/stopSpeaking() call -- same stale-callback
  // guard pattern as speechGeneration in DuplexVoiceEngine.swift (and
  // speechService.ts's speechToken before that): an utterance-progress
  // callback that fires after a NEWER speak() call has already superseded
  // it should not resolve/reject the newer call's promise or flip
  // isSpeaking state out from under it.
  private var speechGeneration = 0
  private var pendingSpeakPromise: Promise? = null

  // See the restart-loop comment above this class -- mirrors
  // recognitionRequestGeneration/recentNoSpeechTimestamps/
  // recentRecognitionErrorTimestamps from DuplexVoiceEngine.swift exactly,
  // same reasoning, same thresholds (kept in sync deliberately rather than
  // re-deriving new numbers with no real-device evidence behind them yet).
  private var recognitionGeneration = 0
  private val recentNoSpeechTimestamps = mutableListOf<Long>()
  private val recentOtherErrorTimestamps = mutableListOf<Long>()

  // BUG FIX (product report: "the speak to interrupt is working on android
  // but its interrupting itself by its own voice echo"). Confirms exactly
  // what this file's own header comment flagged as its single highest-
  // uncertainty area: SpeechRecognizer gives this module no access to the
  // AudioRecord session it's actually capturing from, so there's no way to
  // explicitly attach an AcousticEchoCanceler the way DuplexVoiceEngine.swift
  // does on iOS -- MODE_IN_COMMUNICATION is a best-effort hint to the OS,
  // not a guarantee, and evidently isn't fully suppressing the coach's own
  // TTS output from being picked back up by the mic on this device.
  //
  // A real AEC fix isn't available at this API surface, so this is a
  // software-level heuristic instead: while TTS is actively speaking (plus a
  // short trailing grace window -- speaker output/room echo doesn't cut off
  // the instant onDone fires), any recognized transcript that closely
  // matches the text the coach itself just spoke is almost certainly the mic
  // hearing its own voice, not the user -- so it's dropped rather than
  // forwarded as a real transcript/barge-in trigger. A genuine user
  // interruption will normally say something DIFFERENT from what the coach
  // is saying, so this only suppresses the specific self-echo case, not
  // barge-in generally.
  private var currentTtsText: String? = null
  private var ttsSpeakingActive = false
  private val ttsEchoGraceMs = 700L

  private fun normalizeForEchoCompare(text: String): String =
    text.lowercase(Locale.getDefault()).replace(Regex("[^a-z0-9 ]"), "").replace(Regex("\\s+"), " ").trim()

  private fun isLikelyOwnEcho(candidate: String): Boolean {
    val spoken = currentTtsText ?: return false
    val normCandidate = normalizeForEchoCompare(candidate)
    val normSpoken = normalizeForEchoCompare(spoken)
    if (normCandidate.length < 3 || normSpoken.isEmpty()) return false
    if (normSpoken.contains(normCandidate) || normCandidate.contains(normSpoken)) return true
    val candidateWords = normCandidate.split(" ").filter { it.isNotEmpty() }.toSet()
    val spokenWords = normSpoken.split(" ").filter { it.isNotEmpty() }.toSet()
    if (candidateWords.isEmpty()) return false
    val overlap = candidateWords.intersect(spokenWords).size
    return overlap.toDouble() / candidateWords.size >= 0.6
  }

  private fun emitListeningState(listening: Boolean) {
    val map = Arguments.createMap()
    map.putBoolean("listening", listening)
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("onListeningState", map)
  }

  private fun emitSpeakingState(speaking: Boolean) {
    val map = Arguments.createMap()
    map.putBoolean("speaking", speaking)
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("onSpeakingState", map)
  }

  private fun emitTranscript(text: String, isFinal: Boolean) {
    val map = Arguments.createMap()
    map.putString("text", text)
    map.putBoolean("isFinal", isFinal)
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("onTranscript", map)
  }

  private fun emitError(context: String, message: String) {
    val map = Arguments.createMap()
    map.putString("context", context)
    map.putString("message", message)
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("onError", map)
  }

  private fun currentLocale(): Locale {
    // Matches DuplexVoiceEngine.swift's currentLocaleIdentifier() intent
    // (follow the app's own active language, not just the device's OS
    // locale) -- i18next's resolved language isn't directly reachable from
    // native code here, so this falls back to the device/app configuration
    // locale, same as SpeechRecognizer's own default behavior when no
    // EXTRA_LANGUAGE is set. Close enough for Phase 1; revisit if a
    // product report shows recognition running in the wrong language for
    // a user who's explicitly switched the app's own language away from
    // the device's.
    return reactContext.resources.configuration.locales.get(0) ?: Locale.getDefault()
  }

  @ReactMethod
  fun start(promise: Promise) {
    mainHandler.post {
      try {
        setupEngineIfNeeded()
        beginRecognition()
        promise.resolve(true)
      } catch (e: Exception) {
        emitError("start", e.message ?: "Unknown error")
        promise.reject("duplex_start_failed", e.message, e)
      }
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    mainHandler.post {
      teardown()
      promise.resolve(null)
    }
  }

  @ReactMethod
  fun speak(text: String, promise: Promise) {
    mainHandler.post {
      if (!isEngineSetUp || !ttsReady) {
        promise.reject("duplex_not_started", "start() must resolve before speak()")
        return@post
      }
      val tts = textToSpeech
      if (tts == null) {
        promise.reject("duplex_not_started", "TextToSpeech not initialized")
        return@post
      }
      speechGeneration += 1
      val generation = speechGeneration
      pendingSpeakPromise = promise
      emitSpeakingState(true)
      // See isLikelyOwnEcho's own comment -- currentTtsText/ttsSpeakingActive
      // stay set through the grace window below, not just while onDone
      // hasn't fired yet.
      currentTtsText = text
      ttsSpeakingActive = true
      val utteranceId = UUID.randomUUID().toString()
      tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
        override fun onStart(utteranceId: String?) {}
        override fun onDone(utteranceId: String?) {
          mainHandler.post {
            // See speechGeneration's own comment -- a stale callback from a
            // speak() call already superseded by a newer one (or by
            // stopSpeaking()) must not resolve THIS promise or flip
            // isSpeaking state a second time.
            if (generation != speechGeneration) return@post
            emitSpeakingState(false)
            pendingSpeakPromise?.resolve(null)
            pendingSpeakPromise = null
            // Speaker output/room echo doesn't cut off the instant this
            // fires -- keep treating recognized text as possible echo for a
            // short trailing window rather than clearing it immediately.
            mainHandler.postDelayed({
              if (generation == speechGeneration) ttsSpeakingActive = false
            }, ttsEchoGraceMs)
          }
        }

        @Deprecated("Deprecated in Java")
        override fun onError(utteranceId: String?) {
          mainHandler.post {
            if (generation != speechGeneration) return@post
            emitSpeakingState(false)
            emitError("speak", "TextToSpeech synthesis error")
            pendingSpeakPromise?.reject("duplex_speak_failed", "TextToSpeech synthesis error")
            pendingSpeakPromise = null
            ttsSpeakingActive = false
          }
        }
      })
      val result = tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
      if (result != TextToSpeech.SUCCESS) {
        emitSpeakingState(false)
        pendingSpeakPromise = null
        promise.reject("duplex_speak_failed", "TextToSpeech.speak() returned an error code")
      }
    }
  }

  @ReactMethod
  fun stopSpeaking(promise: Promise) {
    mainHandler.post {
      speechGeneration += 1 // invalidate any in-flight utterance callback
      textToSpeech?.stop()
      emitSpeakingState(false)
      pendingSpeakPromise?.resolve(null)
      pendingSpeakPromise = null
      // Stopped explicitly (e.g. a genuine barge-in already confirmed by the
      // caller) -- no reason to keep suppressing transcripts as possible
      // echo once playback has actually been cut.
      ttsSpeakingActive = false
      promise.resolve(null)
    }
  }

  // PHASE 2 (not implemented yet -- see this file's own header comment).
  // Rejecting here is the correct, intended behavior right now:
  // duplexVoiceService.ts's speakWithFallback() already catches any
  // speakRemote() failure and falls back to on-device speak() instead,
  // exactly the same contract iOS used before its own ElevenLabs path
  // landed.
  @ReactMethod
  fun speakRemoteAudio(uri: String, headers: com.facebook.react.bridge.ReadableMap?, promise: Promise) {
    promise.reject(
      "duplex_speak_remote_not_implemented",
      "speakRemoteAudio is not implemented on Android yet (Phase 2) -- falls back to on-device speech.",
    )
  }

  // Required by React Native's built-in NativeEventEmitter contract even
  // though this module only ever emits -- same no-op pattern
  // ShareIntentModule.kt already uses for the same reason.
  @ReactMethod
  fun addListener(eventName: String) {}

  @ReactMethod
  fun removeListeners(count: Int) {}

  private fun setupEngineIfNeeded() {
    if (isEngineSetUp) return

    val audioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    // See this file's header comment -- the closest Android equivalent to
    // iOS's AVAudioSessionModeVoiceChat: signals a concurrent playback+
    // capture (VoIP-style) scenario to the OS/device, which is what
    // actually engages whatever system-level echo handling the device has,
    // rather than anything this module can control directly.
    audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
    val focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
          .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
          .build(),
      )
      .build()
    audioFocusRequest = focusRequest
    audioManager.requestAudioFocus(focusRequest)

    if (!SpeechRecognizer.isRecognitionAvailable(reactContext)) {
      throw IllegalStateException("Speech recognition is not available on this device")
    }

    val tts = TextToSpeech(reactContext) { status ->
      mainHandler.post {
        ttsReady = status == TextToSpeech.SUCCESS
        if (ttsReady) {
          textToSpeech?.language = currentLocale()
        } else {
          emitError("setupEngineIfNeeded", "TextToSpeech initialization failed (status=$status)")
        }
      }
    }
    textToSpeech = tts

    isEngineSetUp = true
  }

  private fun teardown() {
    speechRecognizer?.let { recognizer ->
      try {
        recognizer.stopListening()
        recognizer.cancel()
        recognizer.destroy()
      } catch (e: Exception) {
        // Best-effort -- a recognizer already in a bad state shouldn't
        // block teardown from completing.
      }
    }
    speechRecognizer = null
    speechGeneration += 1
    textToSpeech?.stop()
    textToSpeech?.shutdown()
    textToSpeech = null
    ttsReady = false
    recognitionGeneration += 1 // invalidate any pending restart Runnable
    recentNoSpeechTimestamps.clear()
    recentOtherErrorTimestamps.clear()
    currentTtsText = null
    ttsSpeakingActive = false
    isEngineSetUp = false
    emitListeningState(false)
    emitSpeakingState(false)

    val audioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
    audioFocusRequest = null
    audioManager.mode = AudioManager.MODE_NORMAL
  }

  private fun beginRecognition() {
    val recognizer = SpeechRecognizer.createSpeechRecognizer(reactContext)
    speechRecognizer = recognizer
    startRecognitionSession(recognizer)
    emitListeningState(true)
  }

  private fun recognizerIntent(): android.content.Intent {
    return android.content.Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
      putExtra(RecognizerIntent.EXTRA_LANGUAGE, currentLocale().toString())
      // Keeps a session alive through natural pauses instead of ending the
      // instant the user takes a breath mid-sentence -- generous values
      // since the restart-on-end loop below already handles the case where
      // a session legitimately ends, so there's no real cost to letting
      // Android's own silence-detection be lenient first.
      putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1500)
      putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1500)
    }
  }

  private fun startRecognitionSession(recognizer: SpeechRecognizer) {
    recognitionGeneration += 1
    val myGeneration = recognitionGeneration

    recognizer.setRecognitionListener(object : RecognitionListener {
      override fun onReadyForSpeech(params: Bundle?) {}
      override fun onBeginningOfSpeech() {}
      override fun onRmsChanged(rmsdB: Float) {}
      override fun onBufferReceived(buffer: ByteArray?) {}
      override fun onEndOfSpeech() {}
      override fun onEvent(eventType: Int, params: Bundle?) {}

      override fun onPartialResults(partialResults: Bundle?) {
        val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        val text = matches?.firstOrNull()
        if (!text.isNullOrEmpty()) {
          recentNoSpeechTimestamps.clear()
          recentOtherErrorTimestamps.clear()
          // See isLikelyOwnEcho's own comment -- a transcript that closely
          // matches what the coach is currently (or just now) speaking is
          // dropped as self-echo, never forwarded as a real transcript/
          // barge-in trigger.
          if (!(ttsSpeakingActive && isLikelyOwnEcho(text))) {
            emitTranscript(text, false)
          }
        }
      }

      override fun onResults(results: Bundle?) {
        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        val text = matches?.firstOrNull()
        if (!text.isNullOrEmpty()) {
          recentNoSpeechTimestamps.clear()
          recentOtherErrorTimestamps.clear()
          if (!(ttsSpeakingActive && isLikelyOwnEcho(text))) {
            emitTranscript(text, true)
          }
        }
        restartAfterSessionEnd(myGeneration, recognizer, delayMs = 250)
      }

      override fun onError(error: Int) {
        if (recognitionGeneration != myGeneration) return // stale session, already superseded
        val message = errorMessage(error)
        emitError("recognitionSession", message)
        // See this file's header comment -- same "no speech" vs. other-
        // error distinction and thresholds as DuplexVoiceEngine.swift's
        // recentNoSpeechTimestamps/recentRecognitionErrorTimestamps, same
        // reasoning: routine silence around startup/mid-conversation
        // shouldn't trip the same rapid-failure guard as a genuinely
        // broken session.
        val now = System.currentTimeMillis()
        val isNoSpeech = error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
        var delayMs = 250L
        if (isNoSpeech) {
          recentNoSpeechTimestamps.removeAll { now - it >= 10_000 }
          recentNoSpeechTimestamps.add(now)
          if (recentNoSpeechTimestamps.size >= 15) {
            recentNoSpeechTimestamps.clear()
            emitError("recognitionSession", "giving up temporarily after sustained 'no speech' loop")
            // BUG AVOIDED (learned the hard way on iOS -- see
            // DuplexVoiceEngine.swift's own "permanent give-up dead-end"
            // fix): a give-up that never restarts leaves the session
            // silently dead for the rest of the visit. This still
            // restarts, just after a longer cooldown instead of the usual
            // pacing.
            delayMs = 5_000L
          }
        } else {
          recentOtherErrorTimestamps.removeAll { now - it >= 3_000 }
          recentOtherErrorTimestamps.add(now)
          if (recentOtherErrorTimestamps.size >= 4) {
            recentOtherErrorTimestamps.clear()
            emitError("recognitionSession", "giving up temporarily after rapid error loop")
            delayMs = 5_000L
          }
        }
        restartAfterSessionEnd(myGeneration, recognizer, delayMs)
      }
    })

    recognizer.startListening(recognizerIntent())
  }

  private fun restartAfterSessionEnd(generation: Int, recognizer: SpeechRecognizer, delayMs: Long) {
    // BUG AVOIDED (see this file's header comment, and
    // DuplexVoiceEngine.swift's own "tight synchronous restart loop" fix
    // for the full real-device story): always posted with a real delay,
    // never called synchronously/inline from inside the listener callback
    // that just fired -- a callback firing synchronously/near-instantly
    // for any reason would otherwise recurse into a tight loop that never
    // gives a fresh session real wall-clock time to hear anything.
    mainHandler.postDelayed({
      if (!isEngineSetUp || recognitionGeneration != generation) return@postDelayed
      startRecognitionSession(recognizer)
    }, delayMs)
  }

  private fun errorMessage(error: Int): String {
    return when (error) {
      SpeechRecognizer.ERROR_NO_MATCH -> "No speech detected"
      SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech detected"
      SpeechRecognizer.ERROR_AUDIO -> "Audio recording error"
      SpeechRecognizer.ERROR_CLIENT -> "Client side error"
      SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission not granted"
      SpeechRecognizer.ERROR_NETWORK -> "Network error"
      SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout"
      SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Recognizer busy"
      SpeechRecognizer.ERROR_SERVER -> "Server error"
      SpeechRecognizer.ERROR_SERVER_DISCONNECTED -> "Server disconnected"
      SpeechRecognizer.ERROR_TOO_MANY_REQUESTS -> "Too many requests"
      SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED -> "Language not supported"
      SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE -> "Language unavailable"
      SpeechRecognizer.ERROR_CANNOT_CHECK_SUPPORT -> "Cannot check support"
      SpeechRecognizer.ERROR_CANNOT_LISTEN_TO_DOWNLOAD_EVENTS -> "Cannot listen to download events"
      else -> "Unknown recognition error ($error)"
    }
  }
}
