import Foundation
import AVFoundation
import Speech

// ModernSpeechTranscriber -- iOS 26+ only wrapper around Apple's new
// SpeechAnalyzer/SpeechTranscriber API (Speech framework, introduced
// alongside iOS 26 -- WWDC 2025 "Bring advanced speech-to-text to your app
// with SpeechAnalyzer"). See DuplexVoiceEngine.swift's own round-16/17
// comments for the full "why": after 15+ rounds exhaustively eliminating
// every audio-graph/format/session-mode/voice-processing hypothesis for
// SFSpeechRecognizer's "No speech detected" failure, an external review of
// the whole investigation's evidence pointed at the API itself, not this
// app's graph -- SFSpeechRecognizer/SFSpeechAudioBufferRecognitionRequest
// is documented by Apple as built around short-form dictation, with a
// teardown/recreate-per-utterance lifecycle (exactly what this file's own
// restart loop has been fighting). SpeechAnalyzer is Apple's own newer
// replacement, explicitly designed for long-form/conversational audio with
// a single continuous input sequence instead of a request-per-utterance
// model -- a much closer match for this file's "always listening,
// continuous session" architecture.
//
// UNCERTAINTY FLAG, READ BEFORE DEBUGGING A BUILD FAILURE HERE: this is a
// brand-new framework (iOS 26 is the current OS as of this file's writing)
// authored without an Xcode instance available to compile/autocomplete
// against. The overall shape (SpeechTranscriber as an analyzer module,
// SpeechAnalyzer orchestrating it, an AsyncStream<AnalyzerInput> feeding
// buffers in, an AsyncSequence of results streamed out) is correct per
// Apple's WWDC25 session and sample code, but a FEW exact method/property
// names below are the most likely single point of a build error -- each
// flagged inline with what to check in Xcode's autocomplete/quick help if
// it doesn't compile as written:
//   1. RESOLVED (real build error): bestAvailableAudioFormat(compatibleWith:)
//      is `async` -- the name was right, the missing `async` on
//      preferredAudioFormat's computed-property getter was the actual bug.
//   2. RESOLVED (real build error): the analyzer's "I'm done, flush
//      everything" method is NOT finishAnalyzing() -- that guess was
//      wrong, per Xcode's own "no member 'finishAnalyzing'" error. It's
//      finalizeAndFinishThroughEndOfInput() (see stop() below).
//   3. SpeechTranscriber.Result.text -- returned as AttributedString (to
//      carry per-run confidence/timing attributes), converted to a plain
//      String via String(result.text.characters) below; confirm that's
//      still the right conversion if this doesn't compile.
//   4. RESOLVED (real runtime crash, EXC_BREAKPOINT inside Apple's own
//      Speech.SpeechRecognizerWorker.preRunRecognition(), with the console
//      logging the exact reason: "Failed precondition: Audio sample data
//      must be 16-bit signed integers"). DuplexVoiceEngine.swift's
//      recognition tap produces Float32 buffers (confirmed by the same
//      session's own log: "format=<AVAudioFormat ... Float32>") --
//      SFSpeechRecognizer tolerated that format directly, but
//      SpeechAnalyzer/AnalyzerInput hard-crashes on anything that isn't
//      16-bit signed integer PCM. append() below now converts every
//      buffer via AVAudioConverter into preferredAudioFormat (queried
//      once, asynchronously, at start()) before handing it to
//      AnalyzerInput -- see convert(_:) and analyzerFormat's own comments.
//
// SEPARATE, NOT YET ADDRESSED: the same console log also showed "Cannot
// use modules with unallocated locales [en_US (fixed en_US)]. Currently
// allocated locales are []. This will be an error in a future release!"
// -- currently only a warning, not what's crashing the app right now (the
// 16-bit PCM precondition above is), so left alone rather than guessing at
// an AssetInventory-allocation API this file has no confirmed name for
// yet. Worth fixing before it becomes a hard error in a future iOS/Speech
// framework release, but not urgent -- if the modern path now runs
// without crashing but genuinely produces zero transcripts, THIS is the
// next thing to investigate (check Xcode's autocomplete on `AssetInventory`
// in the Speech module for the real allocate-locale API).
// None of these affect the ARCHITECTURE -- if one is wrong, it's a
// same-file, few-line fix once Xcode's own error/autocomplete points at the
// real name, not a reason to doubt this approach.
@available(iOS 26.0, *)
final class ModernSpeechTranscriber {

  private let transcriber: SpeechTranscriber
  private let analyzer: SpeechAnalyzer
  private var inputContinuation: AsyncStream<AnalyzerInput>.Continuation?
  private var resultsTask: Task<Void, Never>?
  private var isRunning = false

  // See this file's header comment (item 4) -- CONFIRMED (real crash,
  // "Audio sample data must be 16-bit signed integers"): incoming tap
  // buffers must be converted into this exact format before being wrapped
  // in AnalyzerInput. Resolved once, asynchronously, in start() (before
  // that, it's nil and append() drops buffers rather than crashing --
  // see append()'s own comment); converter is built lazily on first use
  // in convert(_:), matched to whatever format the tap actually turns out
  // to be using.
  private var analyzerFormat: AVAudioFormat?
  private var converter: AVAudioConverter?

  var onPartialTranscript: ((String) -> Void)?
  var onFinalTranscript: ((String) -> Void)?
  var onError: ((Error) -> Void)?

  init(locale: Locale) throws {
    // .volatileResults is what gives us live, still-changing partial
    // transcripts (this app's "onPartialResults"-equivalent) rather than
    // only ever seeing a result once it's fully finalized -- matters for
    // VoiceCoachView's live transcript display and for barge-in latency.
    transcriber = SpeechTranscriber(
      locale: locale,
      transcriptionOptions: [],
      reportingOptions: [.volatileResults],
      attributeOptions: []
    )
    analyzer = SpeechAnalyzer(modules: [transcriber])
  }

  // See DuplexVoiceEngine.swift's own recognitionConnectFormat comment --
  // this file's whole investigation learned the hard way that guessing an
  // audio format instead of asking the API for its actual preferred one is
  // exactly the class of bug that costs weeks. Ask SpeechAnalyzer directly
  // for the format it wants, the same discipline applied everywhere else
  // in this module.
  //
  // BUILD FIX: bestAvailableAudioFormat(compatibleWith:) is `async` (Xcode:
  // "'async' call in a function that does not support concurrency") --
  // this file's own guess didn't account for that, since a plain
  // (non-async) computed property can't make an async call. `get async`
  // is what a computed property needs to do that; callers now need
  // `await preferredAudioFormat`.
  //
  // WIRED IN as of the header comment's item 4 fix: resolved once in
  // start() and cached in analyzerFormat, then used by convert(_:) to
  // build the AVAudioConverter every buffer passes through in append()
  // before reaching AnalyzerInput -- confirmed necessary by a real crash,
  // not just a theoretical concern (SpeechAnalyzer requires 16-bit signed
  // integer PCM; the tap produces Float32).
  var preferredAudioFormat: AVAudioFormat? {
    get async {
      try? await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriber])
    }
  }

  // Starts the analyzer and begins consuming its results stream in the
  // background. Call append(_:) for every buffer from the recognition tap
  // once this returns -- there is no separate "session" object to create
  // per utterance the way SFSpeechAudioBufferRecognitionRequest needed;
  // this stays open across the whole "always listening" duplex session,
  // through TTS playback, silence, and repeated user turns alike, which is
  // the whole point of moving to this API.
  func start() {
    guard !isRunning else { return }
    isRunning = true
    let (stream, continuation) = AsyncStream<AnalyzerInput>.makeStream()
    inputContinuation = continuation

    Task {
      // Resolved before analyzer.start() begins consuming the stream --
      // append() (called from DuplexVoiceEngine.swift's tap callback,
      // potentially already firing by the time this Task gets scheduled)
      // gates on analyzerFormat being non-nil, so a handful of very-early
      // buffers arriving before this line runs are simply dropped rather
      // than crashing or being queued indefinitely. Acceptable for an
      // "always listening" continuous stream -- there's always more audio
      // right behind whatever's dropped here.
      analyzerFormat = await preferredAudioFormat
      do {
        try await analyzer.start(inputSequence: stream)
      } catch {
        self.onError?(error)
      }
    }

    resultsTask = Task {
      do {
        for try await result in transcriber.results {
          let text = String(result.text.characters)
          if text.isEmpty { continue }
          if result.isFinal {
            self.onFinalTranscript?(text)
          } else {
            self.onPartialTranscript?(text)
          }
        }
      } catch {
        // A cancellation from stop() below surfaces here too -- only
        // forward genuine errors, not the expected teardown cancellation.
        if !(error is CancellationError) {
          self.onError?(error)
        }
      }
    }
  }

  func append(_ buffer: AVAudioPCMBuffer) {
    guard isRunning else { return }
    // Not ready yet (see start()'s own comment) -- drop this buffer rather
    // than crash by feeding it to AnalyzerInput unconverted, or queue it
    // indefinitely.
    guard let analyzerFormat else { return }
    guard let converted = convert(buffer, to: analyzerFormat) else { return }
    inputContinuation?.yield(AnalyzerInput(buffer: converted))
  }

  // See this file's header comment (item 4) -- the actual crash fix.
  // DuplexVoiceEngine.swift's tap produces Float32 buffers (whatever
  // format its own audio graph topology happens to be running, see
  // recognitionConnectFormat over there); SpeechAnalyzer hard-crashes on
  // anything that isn't 16-bit signed integer PCM. Converts using
  // AVAudioConverter's pull-based API (Apple's own documented pattern for
  // this): the converter calls inputBlock exactly once per convert() call
  // here since this is a single, already-fully-available buffer, not a
  // live pull from a device.
  private func convert(_ buffer: AVAudioPCMBuffer, to format: AVAudioFormat) -> AVAudioPCMBuffer? {
    if converter == nil {
      converter = AVAudioConverter(from: buffer.format, to: format)
    }
    guard let converter else { return nil }
    let ratio = format.sampleRate / buffer.format.sampleRate
    let outputCapacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 16 // headroom for rounding
    guard let outputBuffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: outputCapacity) else { return nil }
    var conversionError: NSError?
    var suppliedInput = false
    let status = converter.convert(to: outputBuffer, error: &conversionError) { _, inputStatus in
      if suppliedInput {
        inputStatus.pointee = .noDataNow
        return nil
      }
      suppliedInput = true
      inputStatus.pointee = .haveData
      return buffer
    }
    guard status != .error else {
      if let conversionError {
        self.onError?(conversionError)
      }
      return nil
    }
    return outputBuffer
  }

  func stop() {
    guard isRunning else { return }
    isRunning = false
    inputContinuation?.finish()
    inputContinuation = nil
    resultsTask?.cancel()
    resultsTask = nil
    analyzerFormat = nil
    converter = nil
    Task {
      do {
        // BUILD FIX: SpeechAnalyzer has no `finishAnalyzing()` -- that was
        // this file's own flagged guess (see the header comment) for
        // Apple's "I'm done, flush everything" method, and Xcode's real
        // compiler error confirmed it was wrong. The actual method is
        // finalizeAndFinishThroughEndOfInput() -- finalizes analysis of
        // whatever input has already been provided (the inputContinuation
        // was just closed above, so that's everything this session ever
        // sent) and then finishes the analyzer, which is exactly the
        // "clean end of session" this call site wants.
        try await analyzer.finalizeAndFinishThroughEndOfInput()
      } catch {
        // Best-effort -- teardown shouldn't surface a user-facing error
        // for a session that's already being torn down anyway.
      }
    }
  }
}
