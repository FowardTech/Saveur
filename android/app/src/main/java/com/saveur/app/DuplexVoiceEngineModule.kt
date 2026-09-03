package com.saveur.app

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.NoiseSuppressor
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Locale
import java.util.UUID
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString.Companion.toByteString
import org.json.JSONObject

// DuplexVoiceEngineModule -- Android counterpart to ios/caren_family/
// DuplexVoiceEngine.swift. Read that file's own header comment first if
// you haven't -- this module deliberately mirrors its JS-facing contract
// exactly (same method names, same event names/shapes) so
// services/duplexVoiceService.ts needs no per-platform branching beyond
// the isSupportedPlatform check itself; VoiceCoachView.tsx is entirely
// unaware which platform it's talking to (though see that screen's own
// header comment -- as of this writing it still only actually engages the
// duplex engine on iOS; this module is built and proven via
// src/dev/DuplexVoiceTestScreen.tsx first, same rollout discipline iOS's
// own Phase 1/Phase 2 already went through, before ever being wired into
// the live Coach screen for Android).
//
// PHASE 2 (ElevenLabs playback via speakRemoteAudio) IS implemented here,
// via a plain MediaPlayer -- see that method's own comment.
//
// ROUND 2 -- REPLACED SpeechRecognizer WITH AudioRecord + real AEC/NS +
// a backend streaming STT proxy. THE ORIGINAL PROBLEM THIS SOLVES:
// SFSpeechRecognizer on iOS lets an app own the AVAudioEngine/microphone
// directly and feed it raw PCM buffers -- that's what made a single
// shared engine (mic capture + TTS playback on the SAME graph, with
// explicit voice-processing/AEC) possible there. Android's public
// SpeechRecognizer API never exposed that: it owned its OWN internal
// audio capture (typically routed to the device's default recognition
// service, usually Google's), giving this module no access to its
// underlying AudioRecord session -- so there was no way to explicitly
// attach an AcousticEchoCanceler (or any other AudioEffect) to whatever
// SpeechRecognizer was actually recording from. Echo cancellation relied
// entirely on the OS/device's own system-level handling of concurrent
// playback+capture (MODE_IN_COMMUNICATION below), which real-device
// reports confirmed wasn't reliable enough on its own (see
// isLikelyOwnEcho/hasSustainedVoiceEnergy's own comments for the two
// software heuristics built as a stopgap).
//
// The actual fix: stop using SpeechRecognizer and capture raw audio
// directly via AudioRecord, which DOES expose an audio session ID
// (audioSessionId) that AcousticEchoCanceler/NoiseSuppressor can attach
// to -- see startAudioCapture()'s own comment. That trade requires this
// app to do its own speech-to-text on that raw audio instead of getting
// transcripts for free from the OS, so the raw PCM is streamed over a
// WebSocket to this app's own backend (WS /api/v1/stt/stream --
// Saveur-Backend/app/api/stt_stream.py), which proxies it to Deepgram's
// real-time streaming endpoint and relays transcript + VAD events back
// (see handleServerMessage()). isLikelyOwnEcho/hasSustainedVoiceEnergy
// are KEPT as a second-layer safety net rather than removed now that real
// AEC exists: AcousticEchoCanceler/NoiseSuppressor are both optional,
// device-dependent effects (isAvailable() can and does return false on
// real devices), so this still isn't a guarantee the way iOS's Voice-
// Processing I/O unit is -- just a materially stronger attempt than
// MODE_IN_COMMUNICATION alone ever was.
//
// RESTART-LOOP LESSONS CARRIED OVER FROM THE iOS INVESTIGATION (see that
// file's own extensive comments for the full history): a session that
// ends on its own (here: the WebSocket drops -- network blip, backend
// restart, the backend's own idle timeout) must always eventually retry,
// never permanently give up -- see scheduleReconnect()'s own comment.
class DuplexVoiceEngineModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "DuplexVoiceEngine"

  private val mainHandler = Handler(Looper.getMainLooper())
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

  // PHASE 2 (product decision: build ElevenLabs playback on Android now,
  // matching iOS). A plain MediaPlayer streaming the URL directly is the
  // simplest correct choice -- no different in principle from on-device
  // TTS as far as the echo heuristics below are concerned.
  private var mediaPlayer: MediaPlayer? = null

  // ---- Streaming recognition (ROUND 2 -- see this file's header comment)
  // ----

  // Set by start() (Android-only extra args -- see duplexVoiceService.ts's
  // own comment on why: this module needs a backend URL + a fresh auth
  // token to open the WebSocket, neither of which native code should be
  // independently constructing when JS already centralizes both).
  private var streamUrl: String? = null
  private var authToken: String? = null

  // Bumped every time streaming recognition is (re)started or torn down --
  // guards against a stale WebSocketListener callback (onOpen/onMessage/
  // onFailure/onClosed firing for a connection that's already been
  // superseded by a newer start()/stop() call, or a scheduled reconnect
  // that's no longer wanted) acting on state that no longer applies. Same
  // pattern as speechGeneration above and DuplexVoiceEngine.swift's
  // speechGeneration/recognitionRequestGeneration.
  private var streamGeneration = 0
  private var webSocket: WebSocket? = null

  // A single shared client (not one per connection) -- OkHttp's own
  // documented recommendation, since it internally pools connections/
  // threads; pingInterval keeps the connection alive through NAT/proxy
  // idle timeouts on a long-lived "always listening" session, and lets
  // OkHttp itself detect and fail a genuinely dead connection (triggering
  // onFailure -> scheduleReconnect) instead of it silently hanging forever.
  private val httpClient: OkHttpClient by lazy {
    OkHttpClient.Builder().pingInterval(20, TimeUnit.SECONDS).build()
  }

  private var audioRecord: AudioRecord? = null
  private var echoCanceler: AcousticEchoCanceler? = null
  private var noiseSuppressor: NoiseSuppressor? = null
  private var captureThread: Thread? = null
  private val isCapturing = AtomicBoolean(false)

  companion object {
    // Must match Saveur-Backend/app/api/stt_stream.py's own defaults
    // (encoding=linear16&sample_rate=16000&channels=1) -- see
    // duplexVoiceService.ts's buildStreamingSttUrl(), which sends these
    // same values as query params so the two ends of this pipeline never
    // silently disagree about the audio format in flight.
    private const val STREAM_SAMPLE_RATE = 16000
    private const val STREAM_CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
    private const val STREAM_AUDIO_ENCODING = AudioFormat.ENCODING_PCM_16BIT
  }

  // BUG FIX (product report: "the speak to interrupt is working on android
  // but its interrupting itself by its own voice echo"). Kept as a second-
  // layer safety net after ROUND 2's real AEC/NS (see this file's header
  // comment) rather than removed -- AcousticEchoCanceler/NoiseSuppressor
  // are optional, device-dependent effects that can and do report
  // unavailable on real devices, so this heuristic still earns its keep on
  // any device where the real effect isn't available.
  //
  // A real AEC fix isn't guaranteed at this API surface even now, so this
  // stays as a software-level heuristic too: while TTS is actively
  // speaking (plus a short trailing grace window -- speaker output/room
  // echo doesn't cut off the instant onDone fires), any recognized
  // transcript that closely matches the text the coach itself just spoke
  // is almost certainly the mic hearing its own voice, not the user -- so
  // it's dropped rather than forwarded as a real transcript/barge-in
  // trigger. A genuine user interruption will normally say something
  // DIFFERENT from what the coach is saying, so this only suppresses the
  // specific self-echo case, not barge-in generally.
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

  // SECOND SIGNAL (product decision: keep the mic always listening during
  // TTS for real barge-in, rather than pausing it -- text matching alone
  // (isLikelyOwnEcho) already proved insufficient on its own).
  //
  // ROUND 2 CHANGE: this used to be fed by SpeechRecognizer's own
  // onRmsChanged callback, reporting values on that API's unitless internal
  // scale (roughly -2 for near-silence up to ~10 for loud, clear speech on
  // most devices -- NOT real dBFS). That callback doesn't exist anymore now
  // that AudioRecord replaced SpeechRecognizer -- see pcm16Dbfs() below,
  // called directly from the capture loop instead, which computes a real
  // dBFS (decibels relative to full scale: 0 = loudest possible sample,
  // very negative = silence) value straight from the raw PCM16 samples.
  // rmsThresholdDbfs below is a DIFFERENT number from this file's old
  // SpeechRecognizer-scale threshold despite serving the identical
  // purpose. Echo picked up from the device's own speaker tends to look
  // different from deliberate user speech in this signal: either a brief
  // blip that doesn't sustain, or a level tightly synced to the coach's
  // own playback envelope rather than an independent voice. Requiring
  // several consecutive above-threshold readings within a short recent
  // window is a cheap, real second filter -- not foolproof, but a genuine
  // improvement over text matching alone. Thresholds are a reasonable
  // starting point, not calibrated against real-device data yet -- tune
  // rmsThresholdDbfs/minSustainedReadings from real reports if echo still
  // gets through, or real interruptions get missed.
  private val recentRmsReadings = mutableListOf<Pair<Long, Float>>()
  private val rmsThresholdDbfs = -35.0f
  private val rmsSustainWindowMs = 500L
  private val minSustainedReadings = 3

  private fun recordRms(dbfs: Float) {
    val now = System.currentTimeMillis()
    recentRmsReadings.add(now to dbfs)
    recentRmsReadings.removeAll { now - it.first > rmsSustainWindowMs }
  }

  private fun hasSustainedVoiceEnergy(): Boolean {
    val now = System.currentTimeMillis()
    val recent = recentRmsReadings.filter { now - it.first <= rmsSustainWindowMs }
    return recent.count { it.second >= rmsThresholdDbfs } >= minSustainedReadings
  }

  // Combines both signals for the ttsSpeakingActive case: a transcript is
  // treated as self-echo (dropped, not forwarded) if it closely matches
  // what the coach is currently/just now saying, OR if the mic never
  // showed sustained voice-level energy while it came in (a genuine,
  // deliberate interruption should show both independent content AND a
  // real, sustained voice level -- a brief/echo-shaped blip satisfies
  // neither reliably).
  private fun shouldSuppressAsEcho(candidate: String): Boolean {
    if (!ttsSpeakingActive) return false
    return isLikelyOwnEcho(candidate) || !hasSustainedVoiceEnergy()
  }

  // Same reasoning as shouldSuppressAsEcho above, but for the {"type":
  // "speech_started"} VAD event (see handleServerMessage()) -- there's no
  // transcript text yet to run isLikelyOwnEcho against at that point, so
  // only the sustained-energy signal applies.
  private fun shouldForwardSpeechStarted(): Boolean {
    if (!ttsSpeakingActive) return true
    return hasSustainedVoiceEnergy()
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

  // ROUND 2, Android-only (see duplexVoiceService.ts's own comment on this
  // event): the backend's VAD-detected speech onset, forwarded as fast,
  // transcript-independent evidence that "the user started talking" --
  // fires well before any transcript text is available, closing the exact
  // gap the original architecture review flagged (waiting for a transcript
  // is real barge-in latency that a VAD signal avoids). Not emitted on
  // iOS -- ModernSpeechTranscriber/SFSpeechRecognizer have no equivalent
  // source for it, and don't need one, since iOS already has real AEC via
  // its shared AVAudioEngine.
  private fun emitSpeechStarted() {
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("onSpeechStarted", Arguments.createMap())
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
    // locale. Close enough for Phase 1; revisit if a product report shows
    // recognition running in the wrong language for a user who's
    // explicitly switched the app's own language away from the device's.
    return reactContext.resources.configuration.locales.get(0) ?: Locale.getDefault()
  }

  // streamUrl/authToken are Android-only extra args -- see
  // duplexVoiceService.ts's start(): iOS's native start() takes zero
  // arguments (SpeechAnalyzer/SFSpeechRecognizer need neither a backend URL
  // nor an auth token, both being fully on-device), so this asymmetry is
  // deliberate, same precedent as speakRemoteAudio's extra `text` arg.
  @ReactMethod
  fun start(streamUrl: String?, authToken: String?, promise: Promise) {
    mainHandler.post {
      try {
        if (streamUrl.isNullOrEmpty()) {
          throw IllegalArgumentException("streamUrl is required to start streaming recognition")
        }
        this.streamUrl = streamUrl
        this.authToken = authToken ?: ""
        setupEngineIfNeeded()
        beginStreamingRecognition()
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
            // The recognizer itself was never paused (see speak()'s own
            // comment), so nothing needs to be explicitly restarted here.
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
      mediaPlayer?.let { existing ->
        try {
          existing.stop()
        } catch (e: Exception) {
          // Best-effort.
        }
        existing.release()
      }
      mediaPlayer = null
      emitSpeakingState(false)
      pendingSpeakPromise?.resolve(null)
      pendingSpeakPromise = null
      // Stopped explicitly (e.g. a genuine barge-in already confirmed by the
      // caller) -- no reason to keep suppressing transcripts as possible
      // echo once playback has actually been cut. The recognizer itself was
      // never paused (see speak()'s own comment), so there's nothing to
      // restart here.
      ttsSpeakingActive = false
      promise.resolve(null)
    }
  }

  // PHASE 2: real ElevenLabs voice, played via a plain MediaPlayer against
  // the given URL + auth headers -- see mediaPlayer's own comment for why
  // this doesn't need anything more elaborate than that on this platform.
  // `text` is an Android-only extra argument (see duplexVoiceService.ts's
  // speakRemote(), which only passes it on this platform) -- purely for
  // isLikelyOwnEcho's text-matching signal, since this module never
  // synthesizes the audio itself here and has no other way to know what it
  // says. On any failure (bad URL, network, decode), rejects so
  // speakWithFallback() in duplexVoiceService.ts falls back to on-device
  // speak(), exactly the same contract iOS uses.
  @ReactMethod
  fun speakRemoteAudio(uri: String, headers: ReadableMap?, text: String?, promise: Promise) {
    mainHandler.post {
      if (!isEngineSetUp) {
        promise.reject("duplex_not_started", "start() must resolve before speakRemoteAudio()")
        return@post
      }
      // Stop any in-flight on-device utterance or previous remote playback
      // first -- QUEUE_FLUSH-equivalent behavior, matching speak()'s own
      // TextToSpeech.QUEUE_FLUSH.
      textToSpeech?.stop()
      mediaPlayer?.let { existing ->
        try {
          existing.stop()
        } catch (e: Exception) {
          // Best-effort -- a player already released/in a bad state
          // shouldn't block starting the new one.
        }
        existing.release()
      }
      mediaPlayer = null

      speechGeneration += 1
      val generation = speechGeneration
      pendingSpeakPromise = promise
      emitSpeakingState(true)
      currentTtsText = text
      ttsSpeakingActive = true

      try {
        val player = MediaPlayer()
        val headerMap = mutableMapOf<String, String>()
        if (headers != null) {
          val iterator = headers.keySetIterator()
          while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            headers.getString(key)?.let { value -> headerMap[key] = value }
          }
        }
        player.setDataSource(reactContext, Uri.parse(uri), headerMap)
        player.setOnPreparedListener { it.start() }
        player.setOnCompletionListener { completedPlayer ->
          mainHandler.post {
            if (generation == speechGeneration) {
              emitSpeakingState(false)
              pendingSpeakPromise?.resolve(null)
              pendingSpeakPromise = null
              // See speak()'s onDone -- same trailing echo-grace window.
              mainHandler.postDelayed({
                if (generation == speechGeneration) ttsSpeakingActive = false
              }, ttsEchoGraceMs)
            }
            try {
              completedPlayer.release()
            } catch (e: Exception) {
              // Best-effort.
            }
            if (mediaPlayer === completedPlayer) mediaPlayer = null
          }
        }
        player.setOnErrorListener { errorPlayer, what, extra ->
          mainHandler.post {
            if (generation == speechGeneration) {
              emitSpeakingState(false)
              emitError("speakRemoteAudio", "MediaPlayer error (what=$what, extra=$extra)")
              pendingSpeakPromise?.reject(
                "duplex_speak_remote_failed",
                "MediaPlayer error (what=$what, extra=$extra)",
              )
              pendingSpeakPromise = null
              ttsSpeakingActive = false
            }
            try {
              errorPlayer.release()
            } catch (e: Exception) {
              // Best-effort.
            }
            if (mediaPlayer === errorPlayer) mediaPlayer = null
          }
          true // handled -- suppresses the framework's own onCompletion callback for this error
        }
        mediaPlayer = player
        player.prepareAsync()
      } catch (e: Exception) {
        emitSpeakingState(false)
        emitError("speakRemoteAudio", e.message ?: "Failed to start remote playback")
        pendingSpeakPromise = null
        ttsSpeakingActive = false
        promise.reject("duplex_speak_remote_failed", e.message, e)
      }
    }
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
    // complementing (not replacing) the explicit AcousticEchoCanceler/
    // NoiseSuppressor attached in startAudioCapture() below.
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
    streamGeneration += 1 // invalidate any pending reconnect/onOpen/onMessage/onFailure/onClosed callback
    webSocket?.let { socket ->
      try {
        socket.send(JSONObject().put("type", "stop").toString())
      } catch (e: Exception) {
        // Best-effort -- the socket may already be half-closed.
      }
      try {
        socket.close(1000, null)
      } catch (e: Exception) {
        // Best-effort.
      }
    }
    webSocket = null
    stopAudioCaptureOnly()
    textToSpeech?.stop()
    textToSpeech?.shutdown()
    textToSpeech = null
    ttsReady = false
    mediaPlayer?.let { existing ->
      try {
        existing.stop()
      } catch (e: Exception) {
        // Best-effort.
      }
      existing.release()
    }
    mediaPlayer = null
    recentRmsReadings.clear()
    currentTtsText = null
    ttsSpeakingActive = false
    isEngineSetUp = false
    streamUrl = null
    authToken = null
    emitListeningState(false)
    emitSpeakingState(false)

    val audioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
    audioFocusRequest = null
    audioManager.mode = AudioManager.MODE_NORMAL
  }

  // ---- ROUND 2 streaming recognition (see this file's header comment)
  // ----

  private fun beginStreamingRecognition() {
    streamGeneration += 1
    connectStreamingSocket(streamGeneration)
  }

  private fun connectStreamingSocket(generation: Int) {
    val url = streamUrl
    if (url.isNullOrEmpty()) return
    val requestBuilder = Request.Builder().url(url)
    val token = authToken
    if (!token.isNullOrEmpty()) {
      requestBuilder.addHeader("Authorization", "Bearer $token")
    }
    val socket = httpClient.newWebSocket(
      requestBuilder.build(),
      object : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
          mainHandler.post {
            // A newer start()/stop() call, or a reconnect that's since been
            // superseded by yet another reconnect, already moved on --
            // close this now-unwanted connection instead of acting on it.
            if (generation != streamGeneration) {
              try {
                webSocket.close(1000, null)
              } catch (e: Exception) {
                // Best-effort.
              }
              return@post
            }
            if (startAudioCapture(webSocket)) {
              emitListeningState(true)
            } else {
              try {
                webSocket.close(1000, null)
              } catch (e: Exception) {
                // Best-effort.
              }
            }
          }
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
          mainHandler.post {
            if (generation != streamGeneration) return@post
            handleServerMessage(text)
          }
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
          mainHandler.post {
            if (generation != streamGeneration) return@post
            emitError("streamingRecognition", t.message ?: "WebSocket connection failed")
            stopAudioCaptureOnly()
            scheduleReconnect(generation)
          }
        }

        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
          // Acknowledges a server-initiated close (e.g. stt_stream.py's own
          // _IDLE_TIMEOUT_SECONDS disconnect) so OkHttp completes the
          // closing handshake right away instead of leaving the underlying
          // socket lingering open until some later timeout. Thread-safe to
          // call directly here (OkHttp's own documented pattern) -- doesn't
          // touch any of this module's own mutable state, so no need to go
          // through mainHandler.
          webSocket.close(1000, null)
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
          mainHandler.post {
            if (generation != streamGeneration) return@post
            stopAudioCaptureOnly()
            // 1000 = this module's own deliberate close (teardown(), or a
            // superseded connection above) -- anything else is the
            // connection dying out from under us and needs a retry. See
            // scheduleReconnect's own comment.
            if (code != 1000) scheduleReconnect(generation)
          }
        }
      },
    )
    webSocket = socket
  }

  private fun scheduleReconnect(generation: Int) {
    // Same "always eventually retry, never a silent permanent dead-end"
    // discipline as DuplexVoiceEngine.swift's own restart-loop lessons
    // (see this file's header comment) -- a dropped WebSocket (network
    // blip, backend restart, the backend's own idle-timeout disconnect)
    // must not leave Voice mode silently deaf for the rest of the visit.
    mainHandler.postDelayed({
      if (!isEngineSetUp || generation != streamGeneration) return@postDelayed
      connectStreamingSocket(generation)
    }, 2000L)
  }

  private fun handleServerMessage(text: String) {
    // See Saveur-Backend/app/api/stt_stream.py's own docstring for the
    // full message contract this parses.
    val json = try {
      JSONObject(text)
    } catch (e: Exception) {
      return // malformed/unexpected message -- ignore rather than crash
    }
    when (json.optString("type")) {
      "transcript" -> {
        val transcriptText = json.optString("text")
        if (transcriptText.isNotEmpty()) {
          val isFinal = json.optBoolean("isFinal", false)
          if (!shouldSuppressAsEcho(transcriptText)) {
            emitTranscript(transcriptText, isFinal)
          }
        }
      }
      "speech_started" -> {
        if (shouldForwardSpeechStarted()) {
          emitSpeechStarted()
        }
      }
      "error" -> {
        emitError("streamingRecognition", json.optString("message", "Unknown streaming STT error"))
      }
      // "ready" -- informational only (Deepgram connected on the backend
      // side); nothing to do here, audio is already being sent by the time
      // this could arrive.
    }
  }

  // Starts capturing from the device mic via AudioRecord (NOT
  // SpeechRecognizer -- see this file's header comment for why that
  // change was necessary) and streams raw PCM16 frames to `socket` as fast
  // as they're captured. Returns false (having already emitted a specific
  // error) if AudioRecord itself can't be initialized on this device --
  // that's a local capability failure, not a network blip, so the caller
  // closes the socket rather than retrying it.
  private fun startAudioCapture(socket: WebSocket): Boolean {
    if (isCapturing.get()) return true // already capturing (shouldn't normally happen, but idempotent)

    val minBufferSize = AudioRecord.getMinBufferSize(
      STREAM_SAMPLE_RATE, STREAM_CHANNEL_CONFIG, STREAM_AUDIO_ENCODING,
    )
    if (minBufferSize <= 0) {
      emitError("streamingRecognition", "AudioRecord.getMinBufferSize failed on this device/sample rate")
      return false
    }
    val bufferSize = minBufferSize * 2 // headroom, to avoid overrun drops if the read loop briefly lags

    val record: AudioRecord
    try {
      // VOICE_COMMUNICATION (not MIC/DEFAULT): the source Android documents
      // as intended for VoIP-style capture -- on many device HALs this
      // alone already engages some hardware/software AEC/NS/AGC in the
      // signal path, complementing (not replacing) the explicit
      // AcousticEchoCanceler/NoiseSuppressor attached below, same spirit as
      // MODE_IN_COMMUNICATION in setupEngineIfNeeded().
      record = AudioRecord(
        MediaRecorder.AudioSource.VOICE_COMMUNICATION,
        STREAM_SAMPLE_RATE, STREAM_CHANNEL_CONFIG, STREAM_AUDIO_ENCODING, bufferSize,
      )
    } catch (e: SecurityException) {
      emitError("streamingRecognition", "Microphone permission not granted")
      return false
    } catch (e: Exception) {
      emitError("streamingRecognition", e.message ?: "Failed to create AudioRecord")
      return false
    }
    if (record.state != AudioRecord.STATE_INITIALIZED) {
      emitError("streamingRecognition", "AudioRecord failed to initialize on this device")
      try {
        record.release()
      } catch (e: Exception) {
        // Best-effort.
      }
      return false
    }

    // THE WHOLE POINT OF ROUND 2 (see this file's header comment):
    // AudioRecord exposes its own session ID, which SpeechRecognizer never
    // did, so real echo cancellation/noise suppression can finally be
    // explicitly attached here. Both are optional, device-dependent
    // effects -- isAvailable() is a static, device-wide capability check,
    // not a guarantee every device supports either -- so isLikelyOwnEcho/
    // hasSustainedVoiceEnergy above stay in place as a second-layer safety
    // net regardless of whether this succeeds.
    val sessionId = record.audioSessionId
    val aec = if (AcousticEchoCanceler.isAvailable()) {
      try {
        AcousticEchoCanceler.create(sessionId)?.also { it.enabled = true }
      } catch (e: Exception) {
        null
      }
    } else {
      null
    }
    val ns = if (NoiseSuppressor.isAvailable()) {
      try {
        NoiseSuppressor.create(sessionId)?.also { it.enabled = true }
      } catch (e: Exception) {
        null
      }
    } else {
      null
    }
    if (aec == null) {
      emitError(
        "streamingRecognition",
        "AcousticEchoCanceler not available on this device -- relying on the text/RMS echo heuristic only",
      )
    }
    echoCanceler = aec
    noiseSuppressor = ns

    audioRecord = record
    isCapturing.set(true)
    record.startRecording()

    val thread = Thread(
      {
        val buffer = ByteArray(bufferSize)
        while (isCapturing.get()) {
          val read = try {
            record.read(buffer, 0, buffer.size)
          } catch (e: Exception) {
            -1
          }
          if (read > 0) {
            val dbfs = pcm16Dbfs(buffer, read)
            mainHandler.post { recordRms(dbfs) } // see recentRmsReadings's own comment on thread-safety
            try {
              socket.send(buffer.copyOf(read).toByteString())
            } catch (e: Exception) {
              // Best-effort -- if the socket is genuinely gone, its own
              // onFailure/onClosed callback handles teardown/reconnect;
              // nothing productive to do from this background thread.
            }
          }
        }
      },
      "DuplexVoiceEngine-AudioRecord",
    )
    thread.isDaemon = true
    captureThread = thread
    thread.start()
    return true
  }

  // Computes a real dBFS (decibels relative to full scale) value from a
  // chunk of raw PCM16LE samples -- see recentRmsReadings's own comment
  // for why this replaced SpeechRecognizer's onRmsChanged callback.
  private fun pcm16Dbfs(buffer: ByteArray, length: Int): Float {
    var sumSquares = 0.0
    var sampleCount = 0
    var i = 0
    while (i + 1 < length) {
      val sample = ((buffer[i + 1].toInt() shl 8) or (buffer[i].toInt() and 0xFF)).toShort()
      sumSquares += (sample * sample).toDouble()
      sampleCount++
      i += 2
    }
    if (sampleCount == 0) return -120.0f
    val rms = Math.sqrt(sumSquares / sampleCount)
    val dbfs = if (rms > 0) 20.0 * Math.log10(rms / 32768.0) else -120.0
    return dbfs.toFloat()
  }

  // Stops + releases the AudioRecord/AEC/NS/capture thread WITHOUT closing
  // the WebSocket or touching streamGeneration -- used both by teardown()
  // (which handles the socket itself) and by a dropped connection
  // (onFailure/onClosed) that's about to reconnect and start a fresh
  // capture session rather than end the whole engine.
  private fun stopAudioCaptureOnly() {
    isCapturing.set(false)
    // Stopping the AudioRecord first unblocks any in-flight record.read()
    // call in the capture thread immediately, so the join() below is a
    // short, bounded wait in practice rather than a real blocking wait for
    // a full read cycle -- this runs on the main thread (every caller is
    // already inside a mainHandler.post block), so keeping this fast
    // matters.
    try {
      audioRecord?.stop()
    } catch (e: Exception) {
      // Best-effort -- may already be stopped/in a bad state.
    }
    captureThread?.let {
      try {
        it.join(300)
      } catch (e: InterruptedException) {
        // Best-effort.
      }
    }
    captureThread = null
    try {
      audioRecord?.release()
    } catch (e: Exception) {
      // Best-effort.
    }
    audioRecord = null
    try {
      echoCanceler?.release()
    } catch (e: Exception) {
      // Best-effort.
    }
    echoCanceler = null
    try {
      noiseSuppressor?.release()
    } catch (e: Exception) {
      // Best-effort.
    }
    noiseSuppressor = null
    emitListeningState(false)
  }
}
