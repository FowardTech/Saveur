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
//   1. SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith:) -- the
//      exact static/type method name for querying the analyzer's preferred
//      input format may differ slightly.
//   2. RESOLVED (real build error): the analyzer's "I'm done, flush
//      everything" method is NOT finishAnalyzing() -- that guess was
//      wrong, per Xcode's own "no member 'finishAnalyzing'" error. It's
//      finalizeAndFinishThroughEndOfInput() (see stop() below).
//   3. SpeechTranscriber.Result.text -- returned as AttributedString (to
//      carry per-run confidence/timing attributes), converted to a plain
//      String via String(result.text.characters) below; confirm that's
//      still the right conversion if this doesn't compile.
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
  var preferredAudioFormat: AVAudioFormat? {
    try? SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriber])
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
    inputContinuation?.yield(AnalyzerInput(buffer: buffer))
  }

  func stop() {
    guard isRunning else { return }
    isRunning = false
    inputContinuation?.finish()
    inputContinuation = nil
    resultsTask?.cancel()
    resultsTask = nil
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
