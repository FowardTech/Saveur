import Foundation
import AVFoundation
import Speech
import React

// DuplexVoiceEngine — a from-scratch, self-contained native module for true
// concurrent "speak while listening" (real barge-in) on the AI Career
// Coach's voice screen (src/messages/VoiceCoachView.tsx).
//
// WHY THIS EXISTS (read this before touching anything below): this is the
// THIRD attempt at speak-to-interrupt for that screen. The first two both
// failed on a real device:
//   1. Kept the mic running through TTS via a JS-level flag, but never
//      touched the iOS AVAudioSession's MODE — no echo cancellation was
//      engaged at all, and playback+capture together produced total
//      silence and a dead mic.
//   2. Added AVAudioSessionModeVoiceChat via a patch-package patch to
//      @dev-amirzubair/react-native-voice — the mic worked and TTS was
//      audible, but the coach heard and answered its own voice. Root
//      cause: that session-level mode's echo cancellation only cancels
//      audio that the SAME AVAudioEngine renders. react-native-tts
//      (AVSpeechSynthesizer's own playback) and react-native-nitro-sound
//      (ElevenLabs playback) are both separate, independent playback
//      pipelines from react-native-voice's own capture engine — nothing
//      was actually being cancelled.
//
// This module fixes that architecturally by owning ONE AVAudioEngine that
// does both jobs: the coach's speech is synthesized into raw PCM buffers
// and scheduled on a player node ATTACHED TO THIS SAME ENGINE (instead of
// using AVSpeechSynthesizer's own built-in playback), while the mic is
// captured via a tap on this same engine's input node, with voice
// processing (echo cancellation) explicitly enabled on both sides. Because
// render and capture now share one engine, the OS's voice-processing I/O
// unit has an actual reference signal to cancel.
//
// Phase 1 (this file): on-device TTS only (AVSpeechSynthesizer, via its
// buffer-callback API) — deliberately NOT wired to ElevenLabs/remote audio
// yet. Proving the core duplex+AEC mechanism with the simpler, fully
// on-device path first, before adding the extra complexity of decoding a
// remote MP3 stream into the same pipeline, is the whole point: if THIS
// doesn't work on a real device, nothing built on top of it will either,
// and it's much easier to debug in isolation. See
// src/dev/DuplexVoiceTestScreen.tsx for a way to test this file alone,
// without VoiceCoachView's turn-taking logic in the way.
//
// HIGHEST-UNCERTAINTY AREAS (flagged inline below too) — read these before
// assuming a failure is somewhere else:
//   - setVoiceProcessingEnabled(_:) on the input/output nodes is real,
//     documented AVAudioEngine API (iOS 13+), but this was written without
//     the ability to compile or run it. If Xcode reports a signature
//     mismatch, that's a fast, loud, SAFE failure (unlike the previous two
//     attempts' silent runtime audio failures) — fix the signature and
//     rebuild.
//   - The buffer format AVSpeechSynthesizer.write(_:toBufferCallback:)
//     actually delivers can vary by voice/iOS version. This converts every
//     buffer to a fixed target format via AVAudioConverter before
//     scheduling rather than assuming a specific format — if speech comes
//     out silent, distorted, or pitched wrong, this conversion step is the
//     first place to add logging.
@objc(DuplexVoiceEngine)
class DuplexVoiceEngine: RCTEventEmitter {

  private let audioEngine = AVAudioEngine()
  private let playerNode = AVAudioPlayerNode()
  private let speechSynthesizer = AVSpeechSynthesizer()
  private var speechRecognizer: SFSpeechRecognizer?

  private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
  private var recognitionTask: SFSpeechRecognitionTask?

  private var isEngineSetUp = false
  private var isSpeaking = false
  private var hasListeners = false
  // Bumped on every speak() call and on stopSpeaking() -- lets an
  // in-flight AVSpeechSynthesizer buffer callback (which can fire after a
  // newer call superseded it, same class of race documented at length in
  // speechService.ts's speechToken) know to stop scheduling/reporting.
  private var speechGeneration = 0

  // Fixed format every TTS buffer gets converted into before being
  // scheduled on playerNode, decided once when the engine is set up (see
  // setupEngineIfNeeded). Using the OUTPUT hardware's own preferred format
  // rather than a hardcoded guess, since that's what the graph actually
  // needs downstream of the player node.
  private var playerConnectFormat: AVAudioFormat?

  override init() {
    super.init()
    speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: currentLocaleIdentifier()))
  }

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }

  override func supportedEvents() -> [String]! {
    return ["onTranscript", "onListeningState", "onSpeakingState", "onError"]
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  private func emit(_ name: String, _ body: Any) {
    guard hasListeners else { return }
    DispatchQueue.main.async {
      self.sendEvent(withName: name, body: body)
    }
  }

  private func emitError(_ context: String, _ error: Error?) {
    emit("onError", ["context": context, "message": error?.localizedDescription ?? "unknown error"])
  }

  // Locale isn't threaded through from JS yet in this phase-1 test module
  // -- always English. VoiceCoachView's eventual integration would pass
  // the real i18next language through, same as speechService.ts's
  // currentSttLocale().
  private func currentLocaleIdentifier() -> String {
    return "en-US"
  }

  // MARK: - Lifecycle

  @objc(start:rejecter:)
  func start(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      do {
        try self.requestPermissionsIfNeeded()
        try self.setupEngineIfNeeded()
        try self.beginRecognition()
        resolve(true)
      } catch {
        self.emitError("start", error)
        reject("duplex_start_failed", error.localizedDescription, error)
      }
    }
  }

  @objc(stop:rejecter:)
  func stop(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      self.teardown()
      resolve(nil)
    }
  }

  private func requestPermissionsIfNeeded() throws {
    // Both permissions are already declared in Info.plist and already
    // granted in practice by the existing @dev-amirzubair/react-native-
    // voice-based flow (services/speechService.ts) that ships today --
    // this whole function is normally a no-op (both branches below are
    // skipped, status already .granted/.authorized) rather than the first
    // time the user sees either prompt. KNOWN RISK, not yet hit in
    // practice: this blocks the main thread on a DispatchSemaphore while
    // waiting for each permission completion handler, and Apple's docs
    // don't guarantee those handlers run off the main thread -- if this
    // .undetermined path is ever actually exercised (e.g. a fresh install,
    // or the user revokes the permission in Settings and reinstalls) and a
    // handler happens to be dispatched back to main, this would deadlock
    // start() forever instead of resolving or rejecting. Left as-is for
    // now since it isn't what's causing the current no-transcript
    // investigation (start() is resolving fine, meaning this path isn't
    // even being taken) -- but if start() ever hangs without resolving OR
    // rejecting on a fresh install, this is the first place to look, and
    // the real fix is restructuring this as a proper async callback chain
    // instead of a blocking wait.
    let micStatus = AVAudioSession.sharedInstance().recordPermission
    if micStatus == .undetermined {
      let sema = DispatchSemaphore(value: 0)
      AVAudioSession.sharedInstance().requestRecordPermission { _ in sema.signal() }
      sema.wait()
    }
    if SFSpeechRecognizer.authorizationStatus() == .notDetermined {
      let sema = DispatchSemaphore(value: 0)
      SFSpeechRecognizer.requestAuthorization { _ in sema.signal() }
      sema.wait()
    }
  }

  private func setupEngineIfNeeded() throws {
    if isEngineSetUp { return }

    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker, .allowBluetooth])
    try session.setActive(true, options: [])

    let inputNode = audioEngine.inputNode
    let outputNode = audioEngine.outputNode

    // THE key mechanism this whole module exists to add: enable voice
    // processing (the AEC-capable Voice-Processing I/O audio unit) on
    // BOTH nodes of THIS engine -- not just the AVAudioSession's mode
    // (attempt 2's mistake). Best-effort on each independently: if one
    // fails (older iOS, unusual route), the other may still help, and
    // either way this should degrade to "no AEC" rather than block
    // startup entirely -- same posture as every other AVAudioSession/
    // AVAudioEngine call in this file.
    do {
      try inputNode.setVoiceProcessingEnabled(true)
    } catch {
      self.emitError("setVoiceProcessingEnabled(input)", error)
    }
    do {
      try outputNode.setVoiceProcessingEnabled(true)
    } catch {
      self.emitError("setVoiceProcessingEnabled(output)", error)
    }

    // BUG FIX, ROUND 2 (real-device reports, in order: (1) TTS played
    // "chipmunk"-fast -- classic sample-rate mismatch, from converting
    // every TTS buffer to a target format guessed from
    // outputNode.inputFormat(forBus: 0), queried before the engine had
    // even started; (2) after switching that guess to
    // audioEngine.mainMixerNode.outputFormat(forBus: 0) instead, TTS went
    // completely silent -- a DIFFERENT wrong guess, not a fix). Two wrong
    // guesses in a row means guessing the target format from some OTHER
    // node before connecting is the wrong approach entirely. This instead
    // connects playerNode with format: nil -- letting AVAudioEngine itself
    // pick the connection format (from playerNode's own default) -- and
    // then reads back playerNode.outputFormat(forBus: 0) AFTER that
    // connection is established, so playerConnectFormat is guaranteed to
    // be the format the graph is ACTUALLY using for this exact connection,
    // not a value inferred from a different node that may or may not
    // match.
    audioEngine.attach(playerNode)
    audioEngine.connect(playerNode, to: audioEngine.mainMixerNode, format: nil)
    let connectFormat = playerNode.outputFormat(forBus: 0)
    playerConnectFormat = connectFormat
    // mainMixerNode -> outputNode is AVAudioEngine's own default
    // connection, already in place; nothing to do for that link.

    audioEngine.prepare()
    try audioEngine.start()
    isEngineSetUp = true
  }

  private func teardown() {
    recognitionTask?.cancel()
    recognitionTask = nil
    recognitionRequest?.endAudio()
    recognitionRequest = nil
    speechGeneration += 1
    speechSynthesizer.stopSpeaking(at: .immediate)
    playerNode.stop()
    if audioEngine.isRunning {
      audioEngine.inputNode.removeTap(onBus: 0)
      audioEngine.stop()
    }
    isEngineSetUp = false
    isSpeaking = false
    emit("onListeningState", ["listening": false])
    emit("onSpeakingState", ["speaking": false])
    try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
  }

  // MARK: - Speech recognition (continuous, restarts its own request on
  // every end/error -- mirrors services/speechService.ts's useSpeechToText
  // auto-restart model, just running on this module's own engine instead
  // of react-native-voice's. The input tap itself is installed ONCE and
  // stays running continuously through both listening AND speaking -- it's
  // never torn down between turns the way the old sequential model tore
  // down/restarted Voice.start() each time; only the SFSpeechRecognizer
  // *request* underneath it gets swapped out periodically (Apple's
  // recognizer sessions have their own internal duration limit).

  private func beginRecognition() throws {
    guard let recognizer = speechRecognizer, recognizer.isAvailable else {
      throw NSError(domain: "DuplexVoiceEngine", code: 1,
                     userInfo: [NSLocalizedDescriptionKey: "Speech recognizer unavailable"])
    }

    let inputNode = audioEngine.inputNode
    let tapFormat = inputNode.outputFormat(forBus: 0)
    inputNode.removeTap(onBus: 0) // safety net against a stale tap from a previous session
    inputNode.installTap(onBus: 0, bufferSize: 1024, format: tapFormat) { [weak self] buffer, _ in
      self?.recognitionRequest?.append(buffer)
    }

    startRecognitionRequest(with: recognizer)
    emit("onListeningState", ["listening": true])
  }

  // DIAGNOSTIC (same class of fix services/speechService.ts already needed
  // for the OLD react-native-voice pipeline -- see that file's own
  // recentErrorTimestampsRef comment for the full history: a session that
  // errors out instantly on every restart, forever, is otherwise
  // indistinguishable from "just isn't hearing anything" from the outside,
  // because the auto-restart below used to silently swallow every error).
  // A normal end-of-session in this API usually shows up as result.isFinal
  // (not an error) or an occasional "no speech detected" error after a
  // real silence gap -- a TIGHT burst of errors, seconds apart at most, is
  // the signature of a genuinely broken session instead.
  private var recentRecognitionErrorTimestamps: [Date] = []

  private func startRecognitionRequest(with recognizer: SFSpeechRecognizer) {
    let request = SFSpeechAudioBufferRecognitionRequest()
    request.shouldReportPartialResults = true
    // REVERTED (real-device report: every single recognition attempt
    // errored out immediately with "Siri and Dictation are disabled",
    // confirmed via this file's own new error-emission -- see
    // recentRecognitionErrorTimestamps's comment). This used to force
    // on-device-only recognition whenever recognizer.supportsOnDeviceRecognition
    // reported true -- but that property can apparently report true even
    // when the on-device Siri/dictation model isn't actually usable on this
    // device/account, and forcing it produces a hard, immediate failure
    // instead of a graceful fallback. The existing, already-working
    // @dev-amirzubair/react-native-voice-based coach screen (services/
    // speechService.ts) never sets this at all -- it just lets
    // SFSpeechRecognizer pick automatically (on-device, server, or hybrid,
    // whichever is actually available), which is presumably exactly why
    // recognition works fine there on this same device. Leaving this unset
    // here now matches that same proven-working default instead of
    // opting into a mode this device apparently can't actually serve.
    recognitionRequest = request

    recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
      guard let self = self else { return }
      if let result = result {
        // A real result proves this session is alive -- whatever error
        // streak was building is now stale.
        self.recentRecognitionErrorTimestamps.removeAll()
        self.emit("onTranscript", [
          "text": result.bestTranscription.formattedString,
          "isFinal": result.isFinal,
        ])
      }
      if let error = error {
        // Emitted for every error, including the routine "no speech
        // detected" end-of-session case -- deliberately verbose for now
        // (this module is still phase-1/test-only), since right now the
        // open question is literally "is anything happening in here at
        // all", and a quiet failure is exactly what's been impossible to
        // diagnose so far.
        self.emitError("recognitionTask", error)
      }
      if error != nil || (result?.isFinal ?? false) {
        self.recognitionTask = nil
        self.recognitionRequest = nil
        guard self.isEngineSetUp, let recognizer = self.speechRecognizer else { return }
        if error != nil {
          let now = Date()
          self.recentRecognitionErrorTimestamps = self.recentRecognitionErrorTimestamps.filter {
            now.timeIntervalSince($0) < 3
          }
          self.recentRecognitionErrorTimestamps.append(now)
          if self.recentRecognitionErrorTimestamps.count >= 4 {
            self.recentRecognitionErrorTimestamps.removeAll()
            self.emitError("recognitionTask: giving up after rapid error loop", error)
            return // stop silently retrying a session that's demonstrably not working
          }
        }
        // Restart a fresh request immediately, as long as the engine is
        // still meant to be running -- keeps "always listening" alive
        // across the recognizer's own session boundaries, exactly like
        // the old model's guardedVoiceStart did for react-native-voice.
        self.startRecognitionRequest(with: recognizer)
      }
    }
  }

  // MARK: - Speaking (on-device TTS synthesized into this engine's own
  // player node, NOT AVSpeechSynthesizer's own playback -- this is what
  // makes the mic's echo cancellation able to see it at all).

  @objc(speak:resolver:rejecter:)
  func speak(text: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard self.isEngineSetUp else {
        reject("duplex_not_started", "start() must resolve before speak()", nil)
        return
      }
      self.speechGeneration += 1
      let generation = self.speechGeneration
      self.isSpeaking = true
      self.emit("onSpeakingState", ["speaking": true])

      // BUG FIX (real-device crash: "DuplexVoiceEngine.speak(): Tried to
      // resolve a promise more than once"). AVSpeechSynthesizer.write's
      // buffer callback delivers its "finished" signal as an empty buffer
      // -- but in practice this can fire more than once for a single
      // write() call (observed on a real device; Apple doesn't document a
      // strict exactly-once guarantee here, and stopSpeaking(at:) firing
      // mid-synthesis is a plausible second source of it). The
      // `generation` check above guards against a NEWER speak()/stop()
      // call's callback firing after this one was superseded, but it
      // can't tell two calls to the SAME still-current generation's
      // callback apart -- only a plain local flag, independent of
      // generation, guarantees resolve() is only ever actually invoked
      // once no matter how many times this fires.
      var settled = false

      let utterance = AVSpeechUtterance(string: text)
      utterance.voice = AVSpeechSynthesisVoice(language: self.currentLocaleIdentifier())
      utterance.rate = AVSpeechUtteranceDefaultSpeechRate
      utterance.pitchMultiplier = 1.0

      self.speechSynthesizer.write(utterance) { [weak self] buffer in
        guard let self = self else { return }
        // A newer speak()/stop() call superseded this one -- stop
        // scheduling further buffers from this stale synthesis pass, same
        // token-guard pattern as speechService.ts's isStale().
        guard generation == self.speechGeneration else { return }

        guard let pcmBuffer = buffer as? AVAudioPCMBuffer else { return }
        if pcmBuffer.frameLength == 0 {
          // Empty buffer = synthesis finished -- AVSpeechSynthesizer's own
          // documented end-of-utterance signal for this API.
          DispatchQueue.main.async {
            guard generation == self.speechGeneration else { return }
            guard !settled else { return }
            settled = true
            self.isSpeaking = false
            self.emit("onSpeakingState", ["speaking": false])
            resolve(nil)
          }
          return
        }
        self.scheduleSynthesizedBuffer(pcmBuffer, generation: generation)
      }
    }
  }

  private func scheduleSynthesizedBuffer(_ buffer: AVAudioPCMBuffer, generation: Int) {
    guard let targetFormat = playerConnectFormat else { return }

    let bufferToSchedule: AVAudioPCMBuffer
    if buffer.format == targetFormat {
      bufferToSchedule = buffer
    } else {
      // HIGHEST-UNCERTAINTY SPOT (see this file's header comment) --
      // AVSpeechSynthesizer's buffer format isn't guaranteed to match
      // playerConnectFormat (the output hardware's negotiated format).
      // Converting explicitly rather than assuming they match, so a
      // mismatch shows up as a conversion error (loggable) instead of
      // silent/garbled playback.
      guard let converter = AVAudioConverter(from: buffer.format, to: targetFormat) else {
        emitError("scheduleSynthesizedBuffer: no converter", nil)
        return
      }
      let ratio = targetFormat.sampleRate / buffer.format.sampleRate
      let outCapacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 1024
      guard let outBuffer = AVAudioPCMBuffer(pcmFormat: targetFormat, frameCapacity: outCapacity) else { return }
      var conversionError: NSError?
      var consumed = false
      converter.convert(to: outBuffer, error: &conversionError) { _, outStatus in
        if consumed {
          outStatus.pointee = .noDataNow
          return nil
        }
        consumed = true
        outStatus.pointee = .haveData
        return buffer
      }
      if let conversionError = conversionError {
        emitError("scheduleSynthesizedBuffer: convert", conversionError)
        return
      }
      bufferToSchedule = outBuffer
    }

    guard generation == speechGeneration else { return }
    playerNode.scheduleBuffer(bufferToSchedule, completionHandler: nil)
    if !playerNode.isPlaying {
      playerNode.play()
    }
  }

  @objc(stopSpeaking:rejecter:)
  func stopSpeaking(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      self.speechGeneration += 1 // invalidate any in-flight synthesis buffers
      self.speechSynthesizer.stopSpeaking(at: .immediate)
      self.playerNode.stop()
      self.isSpeaking = false
      self.emit("onSpeakingState", ["speaking": false])
      resolve(nil)
    }
  }
}
