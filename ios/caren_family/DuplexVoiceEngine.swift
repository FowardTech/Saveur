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

  // DIAGNOSTIC, ROUND 5, RESULT (real-device console output, five captures
  // now): tried disabling voice processing on both nodes to test whether
  // Apple's Voice-Processing I/O unit was mangling otherwise-loud audio
  // (the rolling amplitude log had just ruled out simple AGC/gain
  // suppression -- confirmed the signal climbs to 0.20-0.97 during real
  // speech). RULED OUT: with voice processing off, recognition STILL
  // failed every single attempt with "No speech detected" -- no change in
  // outcome at all. Meanwhile this experiment cost a real regression (TTS
  // playback broke while it was off), with nothing to show for it. Reverted
  // both setVoiceProcessingEnabled calls below back to a hardcoded true --
  // this was not the cause, and the tradeoff isn't worth repeating. The
  // actual next lead: this same real-device test also exposed that the
  // "give up after sustained no-speech loop" guard (recentNoSpeechTimestamps,
  // further down this file) leaves the engine in a fully silent,
  // permanently-dead state once it trips -- no more restarts, no more
  // errors, nothing -- see that guard's own comment for the fix.

  private let audioEngine = AVAudioEngine()
  private let playerNode = AVAudioPlayerNode()
  // DIAGNOSTIC, ROUND 8: the other, working speech pipeline in this app
  // (node_modules/@dev-amirzubair/react-native-voice/ios/Voice/Voice.mm)
  // never taps audioEngine.inputNode directly -- it attaches its own
  // AVAudioMixerNode, connects inputNode -> that mixer, and installs its
  // recognition tap on the MIXER's output instead. That's a structurally
  // different signal path than this file's tap-directly-on-inputNode
  // approach, independent of the setVoiceProcessingEnabled node flag
  // already ruled out (round 5) and the session mode already ruled out
  // (round 7) -- worth testing on its own since a peak-amplitude reading
  // can look identical on both sides of a tap point while the actual
  // buffer content/format differs. See setupEngineIfNeeded (where this is
  // attached/connected) and beginRecognition (where the tap moves here
  // instead of inputNode) for the rest of this change.
  private let recognitionMixerNode = AVAudioMixerNode()
  private let speechSynthesizer = AVSpeechSynthesizer()
  private var speechRecognizer: SFSpeechRecognizer?

  private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
  private var recognitionTask: SFSpeechRecognitionTask?

  private var isEngineSetUp = false
  private var isSpeaking = false
  private var hasListeners = false
  // BUG FIX (product report, confirmed reproducible even after a full
  // delete+reinstall of the app -- not a caching/timing artifact): the
  // FIRST-ever engine start() in a fresh process consistently never
  // captures real speech (no transcript, no error -- see this file's other
  // diagnostic logging), but the user's own repeated testing showed
  // stopping and restarting it ONCE always fixes it -- which is exactly
  // what happens internally when they navigate away from the Coach screen
  // and back (VoiceCoachView.tsx's focus-effect calls stop() on blur,
  // start() again on refocus). That this is 100% reproducible (not
  // sometimes-works-sometimes-doesn't) rules out the native-module-bridge
  // timing race the JS-side fixes targeted -- this is a different, later
  // stage of the pipeline: something about a completely fresh
  // AVAudioEngine's very first tap/session activation in a process doesn't
  // reliably deliver real audio, but a second activation does. Rather than
  // requiring every user to discover "leave the screen and come back" as a
  // workaround, this flag lets start() automate that exact proven fix
  // transparently -- see start() below.
  private var hasWarmedUpOnce = false
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

  // DIAGNOSTIC (real-device report, mic-warm rollout: engine start()
  // resolves cleanly, no onError ever fires, yet recognitionTask's
  // completion closure never delivers a single transcript even after 20+
  // seconds of the user genuinely speaking into the phone's own mic/
  // speaker, no Bluetooth involved). Every failure mode this file has hit
  // before (chipmunk playback, silent playback, self-listening, "Siri and
  // Dictation disabled") surfaced through EITHER audible playback being
  // obviously wrong OR an onError event -- this is the first report of
  // total silence on BOTH the transcript AND error channels at once, which
  // narrows it to one of: (a) installTap's buffer callback never actually
  // firing at all (the audio graph isn't really delivering input, despite
  // audioEngine.start() having succeeded), or (b) it fires with
  // consistently near-zero-amplitude buffers (voice processing/AGC or a
  // routing issue zeroing out real input before it ever reaches the tap),
  // or (c) real, non-silent buffers ARE reaching recognitionRequest.append
  // and SFSpeechRecognizer itself just never calls back. Those three have
  // very different fixes, and guessing which one blind (again) after two
  // JS-level fixes already didn't resolve this isn't productive. This flag
  // gates a ONE-TIME (per beginRecognition() call, not per-buffer -- no
  // measurable real-time-audio-thread cost) console log of the very first
  // tap buffer's frame count and peak sample amplitude, printed via NSLog
  // (Xcode/device console only -- deliberately NOT surfaced through emit()/
  // onError, which would show as a confusing user-facing red error for
  // what's actually just a diagnostic probe). Next repro with Xcode
  // attached tells us definitively which of (a)/(b)/(c) this actually is.
  private var hasLoggedFirstAudioBuffer = false

  // DIAGNOSTIC, ROUND 4 (real-device console output, three captures in a
  // row now): the "first tap buffer" log above already ruled out (a) --
  // the tap fires and delivers real, non-silent audio every time -- but
  // it only ever tells us the peak of ONE buffer, captured milliseconds
  // after beginRecognition() starts, almost certainly before the user has
  // said anything at all. All three real logs so far show a low peak at
  // that moment (0.0035 / 0.0020 / 0.0069 on a 0-1 scale) and recognition
  // has NEVER succeeded even once, properly paced or not -- which raises
  // exactly the question hasLoggedFirstAudioBuffer's own comment predicted
  // but couldn't answer: is (b) actually the real story here, i.e. does
  // audio reaching the recognizer ever get genuinely loud while the user
  // is mid-speech, or does it stay this quiet the whole session? Given
  // this module explicitly enables setVoiceProcessingEnabled(true) on the
  // input node (Apple's Voice-Processing I/O unit, which applies its own
  // AGC/noise-suppression on top of whatever the hardware gain is) right
  // above in setupEngineIfNeeded(), a signal that never rises above
  // near-silence even during active speech would point squarely at that,
  // not at the recognizer or the network. sessionPeakAmplitude tracks a
  // ROLLING max across every buffer (not just the first), logged and
  // reset every ~2s so a real console capture during actual talking shows
  // whether it ever climbs -- cheap: just a max-abs scan over 1024 Float32
  // samples per ~40Hz tap callback, no allocation.
  private var sessionPeakAmplitude: Float = 0
  private var lastAmplitudeLogTime = Date()

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
        // See hasWarmedUpOnce's own comment above -- the FIRST-ever start
        // in a fresh process reliably fails to capture real speech; a
        // second stop+restart cycle reliably fixes it (this is exactly
        // what manually navigating away from the Coach screen and back
        // already did, proven across repeated real-device tests). Doing
        // that one extra cycle automatically, right here, means every
        // caller -- including the very first one -- gets an engine that's
        // already past whatever this first-activation quirk is, instead
        // of silently capturing nothing until the user stumbles onto the
        // workaround themselves. Only ever runs once per process
        // (hasWarmedUpOnce), so every later start() (after a real
        // background/foreground or screen-focus cycle) stays exactly as
        // fast as it already was -- this is strictly a one-time, first-run
        // cost, not a tax on every start().
        if !self.hasWarmedUpOnce {
          self.hasWarmedUpOnce = true
          NSLog("[DuplexVoiceEngine] first-ever start() this process -- running one internal warm-up stop/restart cycle before resolving")
          self.teardown()
          try self.requestPermissionsIfNeeded()
          try self.setupEngineIfNeeded()
          try self.beginRecognition()
        }
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
    // BUG FIX ATTEMPT (product report: mic stops capturing after a full
    // app close+reopen -- not just backgrounding -- recoverable only by
    // logging out and back in; a plain relaunch alone doesn't fix it).
    // isEngineSetUp itself can't be the explanation -- it's a plain
    // instance property on this class, and iOS creates a brand-new
    // DuplexVoiceEngine instance (starting isEngineSetUp = false, like
    // every other property here) on every fresh process launch, so a
    // relaunch and a logout/login should be IDENTICAL from this file's own
    // state's point of view. The one thing that ISN'T necessarily reset by
    // a relaunch is the shared AVAudioSession itself: if the previous app
    // process was force-quit (swiped away, not just backgrounded) while
    // this engine's session was active, teardown()'s own cleanup -- which
    // explicitly resets voice processing and the session's category/mode
    // back to neutral -- may never have had the chance to run at all (iOS
    // doesn't reliably grant a killed process time to run its own cleanup
    // code). The next launch's setCategory/setActive calls below would
    // then be layering a fresh configuration on top of whatever the
    // session's actual hardware/route state was left in, rather than
    // starting from a genuinely clean slate -- and a full logout/login
    // cycle (more time, more unrelated native activity, effectively a
    // "wait long enough for iOS to reclaim it" scenario) would coincidentally
    // give the OS the chance to release that stale state that a same-second
    // relaunch doesn't. Proactively deactivating first, unconditionally,
    // before reconfiguring -- best-effort, a missing prior session to
    // deactivate is not an error worth failing startup over -- means every
    // setupEngineIfNeeded() call starts from the same known state instead
    // of trusting whatever was there before. UNCONFIRMED without a real
    // device + Xcode console (see this file's other diagnostic logging) --
    // this is the most plausible explanation the code supports, not a
    // verified root cause.
    try? session.setActive(false, options: [.notifyOthersOnDeactivation])
    // DIAGNOSTIC, ROUND 7, RESULT: tried dropping the session mode from
    // .voiceChat to .default (matching the other, working speech pipeline
    // in this app) to see whether the VoIP-tuned mode itself was the
    // problem. RULED OUT -- the very next real-device capture showed the
    // exact same "No speech detected" failure, same pacing, same zero
    // correlation with audio level (peak 0.69 that round, same as always).
    // Reverted back to .voiceChat, since it was providing real AEC benefit
    // for no cost once ruled out as the cause. See startRecognitionRequest
    // for the next thing this same comparison turned up and is now
    // testing instead: the working pipeline taps an intermediate mixer
    // node rather than the input node directly, and sets a taskHint this
    // file never has.
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

    // See recognitionMixerNode's own comment -- attach it and connect
    // inputNode's raw output into it (format: nil, same "let the engine
    // pick the real connection format" approach already proven correct
    // for playerNode above, rather than guessing). This mixer has no
    // further downstream connection of its own -- it exists purely as a
    // tap point for beginRecognition(), not to route audio anywhere else,
    // which is a valid, self-contained branch off the input node.
    audioEngine.attach(recognitionMixerNode)
    audioEngine.connect(inputNode, to: recognitionMixerNode, format: nil)

    audioEngine.prepare()
    try audioEngine.start()
    isEngineSetUp = true
    // DIAGNOSTIC (see the session.setActive(false) fix above) -- confirms
    // what route/category the session actually settled on after the
    // proactive reset, so the next real-device repro (close+reopen, no
    // logout) shows whether this is genuinely a clean .playAndRecord/
    // .voiceChat session or something unexpected (e.g. still reporting a
    // stale route from before the relaunch).
    let activeSession = AVAudioSession.sharedInstance()
    NSLog("[DuplexVoiceEngine] engine started: category=\(activeSession.category.rawValue) mode=\(activeSession.mode.rawValue) route=\(activeSession.currentRoute)")
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
      // See recognitionMixerNode's own comment -- the recognition tap now
      // lives on that mixer node, not directly on inputNode.
      recognitionMixerNode.removeTap(onBus: 0)
      audioEngine.stop()
    }
    // BUG FIX (real-device report: BOTH this engine's own recognition AND
    // the completely separate, previously-proven @dev-amirzubair/react-
    // native-voice pipeline used elsewhere in the app -- e.g. Mock
    // Interview's Voice mode, which shares NO code with this file at all
    // -- stopped capturing any speech whatsoever after this screen was
    // ever visited, with zero errors from either side. setupEngineIfNeeded
    // above calls setVoiceProcessingEnabled(true) on both nodes (swaps
    // their audio unit to iOS's Voice-Processing I/O unit) AND sets the
    // shared AVAudioSession's mode to .voiceChat -- a session-level
    // setting, not scoped to this module, that applies aggressive,
    // VoIP-tuned audio processing (AGC / noise suppression) to WHATEVER
    // uses that session next. Neither was ever being undone here --
    // audioEngine.stop() and setActive(false) alone don't reset either
    // one. Since the AVAudioSession is one shared, process-global
    // resource, any other capture activated afterward (including a
    // totally different native module on a totally different screen)
    // would inherit this same .voiceChat-tuned session instead of a clean,
    // neutral one -- degrading or outright killing its own capture with
    // nothing anywhere surfacing an error. This also explains why the
    // problem didn't improve across several JS-only fixes already shipped
    // this round: this native session state persists across JS/Metro
    // reloads, and only clears on a genuine app relaunch -- so a bad
    // session left by an early test attempt would keep poisoning every
    // later attempt regardless of what changed in JS. Explicitly reversing
    // both -- voice processing off, session mode back to .default -- is
    // what setup should have been paired with here from the start.
    do {
      try audioEngine.inputNode.setVoiceProcessingEnabled(false)
    } catch {
      emitError("teardown: setVoiceProcessingEnabled(input, false)", error)
    }
    do {
      try audioEngine.outputNode.setVoiceProcessingEnabled(false)
    } catch {
      emitError("teardown: setVoiceProcessingEnabled(output, false)", error)
    }
    isEngineSetUp = false
    isSpeaking = false
    emit("onListeningState", ["listening": false])
    emit("onSpeakingState", ["speaking": false])
    do {
      try AVAudioSession.sharedInstance().setCategory(.playAndRecord, mode: .default, options: [])
    } catch {
      emitError("teardown: reset session mode", error)
    }
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

    // DIAGNOSTIC, ROUND 4 -- one-time-per-session, rules out (or confirms)
    // an availability/permission/network-vs-on-device split that would be
    // otherwise invisible: start() already only gets this far when
    // recognizer.isAvailable was true at that instant, but availability
    // CAN flip (e.g. a device that only supports on-device recognition
    // losing network mid-session, or vice versa) -- and neither
    // authorizationStatus nor recordPermission being anything other than
    // "authorized"/"granted" here would itself explain silent failures
    // that a UI permission prompt was never shown for.
    let recordPermission = AVAudioSession.sharedInstance().recordPermission
    NSLog("[DuplexVoiceEngine] beginRecognition: recognizer.isAvailable=\(recognizer.isAvailable) supportsOnDeviceRecognition=\(recognizer.supportsOnDeviceRecognition) speechAuth=\(SFSpeechRecognizer.authorizationStatus().rawValue) recordPermission=\(recordPermission.rawValue)")

    // DIAGNOSTIC, ROUND 8 (see recognitionMixerNode's own comment): tapping
    // the mixer node connected off inputNode, instead of inputNode
    // directly, to match the other, working speech pipeline's structure.
    let tapNode = recognitionMixerNode
    let tapFormat = tapNode.outputFormat(forBus: 0)
    tapNode.removeTap(onBus: 0) // safety net against a stale tap from a previous session
    hasLoggedFirstAudioBuffer = false // see this flag's own comment above -- reset per session
    sessionPeakAmplitude = 0
    lastAmplitudeLogTime = Date()
    tapNode.installTap(onBus: 0, bufferSize: 1024, format: tapFormat) { [weak self] buffer, _ in
      guard let self = self else { return }
      let frameLength = Int(buffer.frameLength)
      var peak: Float = 0
      if let channelData = buffer.floatChannelData, frameLength > 0 {
        let samples = channelData[0]
        for i in 0..<frameLength {
          peak = max(peak, abs(samples[i]))
        }
      }
      // See hasLoggedFirstAudioBuffer's own comment -- ONE-TIME diagnostic.
      if !self.hasLoggedFirstAudioBuffer {
        self.hasLoggedFirstAudioBuffer = true
        NSLog("[DuplexVoiceEngine] first recognition tap buffer (mixer node): frames=\(frameLength) format=\(tapFormat) peakAmplitude=\(peak)")
      }
      // See sessionPeakAmplitude's own comment -- rolling max, logged and
      // reset roughly every 2s so a real capture during actual talking
      // shows whether the signal reaching the recognizer ever gets loud.
      self.sessionPeakAmplitude = max(self.sessionPeakAmplitude, peak)
      let now = Date()
      if now.timeIntervalSince(self.lastAmplitudeLogTime) >= 2.0 {
        NSLog("[DuplexVoiceEngine] rolling peak amplitude (last ~2s): \(self.sessionPeakAmplitude)")
        self.sessionPeakAmplitude = 0
        self.lastAmplitudeLogTime = now
      }
      self.recognitionRequest?.append(buffer)
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

  // BUG FIX, ROUND 2 (real-device console output, product report: a prior
  // fix here stopped counting "No speech detected" toward the give-up
  // threshold at all, reasoning it was routine startup silence -- WRONG,
  // or at least incomplete. The very next real-device test showed the
  // actual shape of the problem: not a handful of errors at startup, but
  // HUNDREDS of identical "No speech detected" errors logged back-to-back
  // in what was clearly a span of well under a second of real time. That
  // rate is not Apple's recognizer legitimately timing out on silence --
  // real silence-detection timeouts take real seconds. It's this file's
  // OWN restart call (`self.startRecognitionRequest(with: recognizer)`
  // below) recursing SYNCHRONOUSLY, on the same call stack, from inside
  // the very completion closure that just fired -- if recognitionTask's
  // completion handler is invoked synchronously/near-instantly for
  // whatever underlying reason (a bad request state, a rate limit, no
  // viable recognition path at all), each new request lives for
  // microseconds before being torn down and replaced by the next one,
  // never getting a real chance to see any of the audio actually arriving
  // from the input tap -- so of course every single one reports "no
  // speech," forever, in a tight loop that also pegs the main thread.
  // Fixed two ways: (1) the restart below is now always dispatched
  // asynchronously with a short delay instead of called directly inline,
  // which structurally breaks any synchronous recursion regardless of
  // why the completion handler fired so fast, and gives each fresh
  // request genuine wall-clock time to actually receive audio before the
  // next teardown; (2) "No speech detected" is back to counting toward a
  // give-up threshold -- just a much more lenient one than other error
  // types, tolerant of a few legitimate occurrences around startup, but
  // still catching a genuinely stuck device (no network AND no usable
  // on-device model, the underlying case this symptom most likely traces
  // to) instead of spinning on it forever.
  private var recentNoSpeechTimestamps: [Date] = []

  // DIAGNOSTIC (see hasLoggedFirstAudioBuffer's own comment for the full
  // "why" -- this covers possibility (c) there: real, non-silent buffers
  // reaching recognitionRequest.append but SFSpeechRecognizer's own
  // completion closure never calling back at all, neither a result nor an
  // error, for the whole 20+ second window the JS side already waits
  // before giving up. Bumped on every startRecognitionRequest() call so a
  // stale check from a PRIOR request (already superseded by a fresh one --
  // the normal restart-on-isFinal/error cycle) never fires against the
  // current one.
  private var recognitionRequestGeneration = 0

  private func startRecognitionRequest(with recognizer: SFSpeechRecognizer) {
    recognitionRequestGeneration += 1
    let myGeneration = recognitionRequestGeneration
    var receivedAnyCallback = false
    DispatchQueue.main.asyncAfter(deadline: .now() + 8) { [weak self] in
      guard let self = self, self.recognitionRequestGeneration == myGeneration, !receivedAnyCallback else { return }
      NSLog("[DuplexVoiceEngine] recognitionTask has received NEITHER a result NOR an error 8s into this request -- SFSpeechRecognizer's completion closure appears to never be calling back at all for this session.")
    }

    let request = SFSpeechAudioBufferRecognitionRequest()
    request.shouldReportPartialResults = true
    // DIAGNOSTIC, ROUND 8 (same comparison as recognitionMixerNode's own
    // comment): the other, working speech pipeline
    // (@dev-amirzubair/react-native-voice) explicitly sets
    // taskHint = .dictation on its request; this file has never set
    // taskHint at all (defaults to .unspecified), which affects Apple's
    // internal endpointing/voice-activity tuning. Cheap, safe to combine
    // with the mixer-node change above in the same test.
    request.taskHint = .dictation
    // RE-REVERTED, ROUND 6 RESULT (real-device console output, seven
    // captures now): forcing requiresOnDeviceRecognition = true reproduced
    // the EXACT same immediate, hard "Siri and Dictation are disabled"
    // failure as the very first time this was tried, confirmed on every
    // single attempt this round with zero exceptions -- this is not
    // flaky, it's a deterministic device-level block. This is genuinely
    // useful, conclusive signal (not a dead end like the voice-processing
    // experiment): the on-device Siri/Dictation model is definitively
    // disabled or otherwise unusable for this app on this device/account
    // right now, regardless of what recognizer.supportsOnDeviceRecognition
    // itself reports (that property reflects device/locale CAPABILITY,
    // not current enablement -- a known gap between the two). Forcing
    // on-device is strictly worse than leaving this unset: unset at least
    // lets SFSpeechRecognizer fall back to attempting server-based
    // recognition instead of hard-blocking every single attempt
    // instantly, so this is reverted back to unset, matching the
    // already-proven-working @dev-amirzubair/react-native-voice-based
    // pipeline elsewhere in this app (services/speechService.ts), which
    // never sets this either.
    //
    // ACTIONABLE NEXT STEP, not a code change: this points at this
    // specific test device's Settings, most likely one of --
    //   Settings > General > Keyboard > Enable Dictation (must be ON)
    //   Settings > Screen Time > Content & Privacy Restrictions >
    //     Siri & Dictation (if Content & Privacy Restrictions are
    //     enabled at all, this can silently block dictation even
    //     when the toggle above looks fine)
    // With that ruled in or out, whether the still-unexplained "No
    // speech detected" failures (present with this unset, as they were
    // for every capture before this round) are a SEPARATE server-path/
    // network issue, or were actually downstream of this same
    // Siri/Dictation restriction the whole time, becomes answerable.
    recognitionRequest = request

    recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
      receivedAnyCallback = true // see the diagnostic timer's own comment above
      guard let self = self else { return }
      if let result = result {
        // A real result proves this session is alive -- whatever error
        // streak was building is now stale.
        self.recentRecognitionErrorTimestamps.removeAll()
        self.recentNoSpeechTimestamps.removeAll()
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
        if let error = error {
          let now = Date()
          let isNoSpeechDetected = (error as NSError).localizedDescription == "No speech detected"
          if isNoSpeechDetected {
            // See recentNoSpeechTimestamps' own comment -- lenient on its
            // own (a real device can legitimately hit this a few times
            // around startup/mid-conversation silence), but a sustained
            // flood over a real multi-second window still gives up rather
            // than spinning forever on a device with no viable
            // recognition path at all.
            self.recentNoSpeechTimestamps = self.recentNoSpeechTimestamps.filter {
              now.timeIntervalSince($0) < 10
            }
            self.recentNoSpeechTimestamps.append(now)
            if self.recentNoSpeechTimestamps.count >= 15 {
              self.recentNoSpeechTimestamps.removeAll()
              self.emitError("recognitionTask: giving up after sustained 'no speech detected' loop", error)
              // BUG FIX (real-device report, "nothing is even working
              // anymore": this used to `return` here, unconditionally --
              // stopping startRecognitionRequest from EVER being called
              // again for the rest of this session. The mic tap stays
              // installed and audio keeps flowing (confirmed: the rolling
              // amplitude log kept printing for well over a minute after
              // this exact message), but nothing is ever submitted to the
              // recognizer again -- a permanently dead, silent session
              // with zero further errors to signal it, indistinguishable
              // from a frozen app. Restarting after a longer cooldown
              // instead keeps the give-up guard's real purpose (stop
              // hammering a session that just failed 15 times in 10s)
              // without leaving the coach unable to ever hear the user
              // again for the rest of the visit.
              cooldownRestart(recognizer)
              return
            }
          } else {
            self.recentRecognitionErrorTimestamps = self.recentRecognitionErrorTimestamps.filter {
              now.timeIntervalSince($0) < 3
            }
            self.recentRecognitionErrorTimestamps.append(now)
            if self.recentRecognitionErrorTimestamps.count >= 4 {
              self.recentRecognitionErrorTimestamps.removeAll()
              self.emitError("recognitionTask: giving up after rapid error loop", error)
              // See the "No speech detected" give-up branch's own comment
              // just above -- same fix, same reasoning, applied here too.
              cooldownRestart(recognizer)
              return
            }
          }
        }
        // BUG FIX (see recentNoSpeechTimestamps' own comment for the full
        // story): this used to call startRecognitionRequest directly,
        // inline, from inside this same completion closure -- if the
        // closure fires synchronously/near-instantly (confirmed on a real
        // device: hundreds of identical "No speech detected" errors
        // logged in well under a second), that recursed into a tight
        // synchronous loop where every fresh request was torn down before
        // it ever had a real chance to see any audio. Dispatching the
        // restart with a short delay instead structurally breaks that
        // loop regardless of why the closure fired so fast, and gives
        // each new request genuine wall-clock time to actually receive
        // real audio from the input tap before the next teardown.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self] in
          guard let self = self, self.isEngineSetUp else { return }
          self.startRecognitionRequest(with: recognizer)
        }
      }
    }
  }

  // See both give-up branches above -- a longer cooldown (vs. the normal
  // 0.25s restart pacing) before trying again after a give-up specifically,
  // so a session that just failed 15 times in ~10s doesn't immediately pile
  // up another 15 failures in the next 10s, while still eventually giving
  // the user another real chance instead of going silent forever.
  private func cooldownRestart(_ recognizer: SFSpeechRecognizer) {
    DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) { [weak self] in
      guard let self = self, self.isEngineSetUp else { return }
      self.startRecognitionRequest(with: recognizer)
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

  // Shared by both speech paths (on-device TTS's streamed buffers below,
  // and ElevenLabs' single big decoded buffer further down) -- converts
  // any source PCM buffer to playerConnectFormat (see setupEngineIfNeeded's
  // own comment on why that format is read back from the actual
  // connection rather than guessed). Returns nil (after emitting an error)
  // on failure, rather than silently scheduling a mismatched buffer --
  // this exact class of mismatch is what caused the chipmunk-speed bug
  // fixed above; a loud conversion error is far preferable to quietly
  // playing something wrong again.
  private func convertBuffer(_ buffer: AVAudioPCMBuffer, to targetFormat: AVAudioFormat, context: String) -> AVAudioPCMBuffer? {
    if buffer.format == targetFormat {
      return buffer
    }
    guard let converter = AVAudioConverter(from: buffer.format, to: targetFormat) else {
      emitError("\(context): no converter", nil)
      return nil
    }
    let ratio = targetFormat.sampleRate / buffer.format.sampleRate
    let outCapacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 1024
    guard let outBuffer = AVAudioPCMBuffer(pcmFormat: targetFormat, frameCapacity: outCapacity) else { return nil }
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
      emitError("\(context): convert", conversionError)
      return nil
    }
    return outBuffer
  }

  private func scheduleSynthesizedBuffer(_ buffer: AVAudioPCMBuffer, generation: Int) {
    guard let targetFormat = playerConnectFormat else { return }
    guard let bufferToSchedule = convertBuffer(buffer, to: targetFormat, context: "scheduleSynthesizedBuffer") else { return }

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

  // MARK: - ElevenLabs / remote-audio speaking. Phase 2 -- built and
  // tested in isolation via DuplexVoiceTestScreen.tsx's own "Speak
  // (ElevenLabs)" button ONLY after phase 1 (on-device TTS through this
  // same engine) was confirmed working on a real device -- see this
  // file's header comment. `uri`/`headers` are resolved entirely in JS
  // (services/duplexVoiceService.ts, reusing services/speechService.ts's
  // existing fetchElevenLabsAudioUrl -- same backend call, same Firebase
  // auth header, already proven working for the OLD TTS pipeline) so
  // this native side has no auth/API logic of its own to duplicate or get
  // wrong -- it only has to download the already-resolved URL, decode it,
  // and play it through the SAME duplex engine as on-device speech.
  @objc(speakRemoteAudio:headers:resolver:rejecter:)
  func speakRemoteAudio(uri: String, headers: NSDictionary, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    guard let url = URL(string: uri) else {
      reject("duplex_bad_url", "Invalid audio URL", nil)
      return
    }
    guard isEngineSetUp else {
      reject("duplex_not_started", "start() must resolve before speakRemoteAudio()", nil)
      return
    }
    speechGeneration += 1
    let generation = speechGeneration
    isSpeaking = true
    emit("onSpeakingState", ["speaking": true])

    var request = URLRequest(url: url)
    for (key, value) in headers {
      if let k = key as? String, let v = value as? String {
        request.setValue(v, forHTTPHeaderField: k)
      }
    }

    URLSession.shared.dataTask(with: request) { [weak self] data, _, error in
      guard let self = self else { return }
      // A newer speak()/speakRemoteAudio()/stop() call (or a manual
      // interrupt) superseded this one while the download was in flight --
      // same token-guard pattern used throughout this file.
      guard generation == self.speechGeneration else { return }

      let finishFailure: (String, String, Error?) -> Void = { code, message, err in
        DispatchQueue.main.async {
          guard generation == self.speechGeneration else { return }
          self.isSpeaking = false
          self.emit("onSpeakingState", ["speaking": false])
          reject(code, message, err)
        }
      }

      if let error = error {
        finishFailure("duplex_remote_fetch_failed", error.localizedDescription, error)
        return
      }
      guard let data = data, !data.isEmpty else {
        finishFailure("duplex_remote_fetch_empty", "Empty audio response", nil)
        return
      }

      // AVAudioFile can decode common compressed formats (MP3/AAC/etc,
      // via ExtAudioFile under the hood) but only from a file URL, not raw
      // Data in memory -- writing to a temp file first is the standard,
      // documented way to decode an in-memory compressed audio blob with
      // this API.
      let tmpURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".audio")
      do {
        try data.write(to: tmpURL)
        defer { try? FileManager.default.removeItem(at: tmpURL) }

        let audioFile = try AVAudioFile(forReading: tmpURL)
        // .processingFormat is AVAudioFile's own already-DECODED (PCM)
        // format -- reading into a buffer of this format is what actually
        // does the MP3/AAC decode; convertBuffer() below still separately
        // handles the (likely, given this is a different source encoder)
        // sample-rate/channel mismatch between THIS format and
        // playerConnectFormat.
        let sourceFormat = audioFile.processingFormat
        guard let sourceBuffer = AVAudioPCMBuffer(pcmFormat: sourceFormat, frameCapacity: AVAudioFrameCount(audioFile.length)) else {
          throw NSError(domain: "DuplexVoiceEngine", code: 3, userInfo: [NSLocalizedDescriptionKey: "Could not allocate decode buffer"])
        }
        try audioFile.read(into: sourceBuffer)

        DispatchQueue.main.async {
          guard generation == self.speechGeneration else { return }
          guard let targetFormat = self.playerConnectFormat,
                let bufferToSchedule = self.convertBuffer(sourceBuffer, to: targetFormat, context: "speakRemoteAudio") else {
            self.isSpeaking = false
            self.emit("onSpeakingState", ["speaking": false])
            reject("duplex_remote_decode_failed", "Could not convert decoded audio to the engine's playback format", nil)
            return
          }
          var settled = false
          // Unlike on-device TTS's streamed empty-buffer "finished" signal
          // (see speak() above), this is ONE complete buffer scheduled
          // once -- .dataPlayedBack gives a completion callback tied to
          // actual audible playback finishing, not just the data being
          // handed off to the render graph, which is the more accurate of
          // the two for "the user can no longer hear this" purposes.
          self.playerNode.scheduleBuffer(bufferToSchedule, at: nil, options: [], completionCallbackType: .dataPlayedBack) { _ in
            DispatchQueue.main.async {
              guard generation == self.speechGeneration else { return }
              guard !settled else { return }
              settled = true
              self.isSpeaking = false
              self.emit("onSpeakingState", ["speaking": false])
              resolve(nil)
            }
          }
          if !self.playerNode.isPlaying {
            self.playerNode.play()
          }
        }
      } catch {
        finishFailure("duplex_remote_decode_failed", error.localizedDescription, error)
      }
    }.resume()
  }
}
