import React, { memo } from 'react';
import { AppState, Image, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

import Text from 'components/Text';
import { Images } from 'assets/images';
import * as coachService from 'services/coachService';
import { CoachUserContext } from 'services/coachService';
import * as speechService from 'services/speechService';
import * as duplexVoiceService from 'services/duplexVoiceService';
import { actionTitle } from 'services/suggestedActions';
import { SuggestedActionId } from 'constants/Types';
import ThemeContext from '../../ThemeContext';

// Live, continuous voice conversation with the AI coach — replaces the
// text-chat box as the default way to talk to the coach (see Chat.tsx's
// mode toggle), per explicit product direction: "instead of it being a
// text chat it should be a AI voice responding to the user when the user
// talks with the AI... like a chat but a voice response... a conversation
// between a coach and a student kind."
//
// Visuals deliberately reuse the exact same pulsing orb used by the
// mock-interview Voice mode (src/practice/LiveInterviewSession.tsx) — same
// ORB_SIZE/HALO_SIZE, same Images.voiceOrb image, same reanimated pulse
// approach — so this feels like the same app's voice UI, not a
// one-off screen. The first version of this screen used the shared Flex
// component with `vertical center` for layout, which doesn't do what it
// looks like it does: Flex's `justify` prop defaults to "space-between",
// and `center` only centers the Flex box itself within ITS parent (via
// alignSelf), not its children — so the orb, status line, and transcript
// ended up shoved to the top/middle/bottom of the whole screen with huge
// gaps between them instead of forming one centered cluster. Fixed here by
// using a plain View + StyleSheet, same as LiveInterviewSession.tsx does.
//
// Turn-taking model (Android / any platform without the duplex engine —
// see below): services/speechService.ts's useSpeechToText() already
// auto-restarts listening on every pause (built for Voice-mode interview
// answers), which this reuses as-is for "always listening" rather than
// inventing a second speech pipeline. What's new here is *silence-based
// turn detection* on top of that continuous stream: whenever the
// recognized transcript changes, a short timer restarts; if nothing new
// comes in before it fires, that's treated as the end of the user's turn,
// and the accumulated transcript is sent to the coach.
//
// Interruption / barge-in: real, speech-triggered barge-in on BOTH
// platforms, selected once per session via
// duplexVoiceService.isDuplexVoiceSupported() -- true whenever the native
// DuplexVoiceEngine module resolves, which it does on iOS
// (ios/caren_family/DuplexVoiceEngine.swift) and on Android
// (android/.../DuplexVoiceEngineModule.kt) alike. The mic runs
// continuously through both listening AND the coach's own speech; if the
// user starts talking while the coach is mid-reply, the coach is cut off
// immediately (see the barge-in effect below). Tapping the orb / "Tap to
// interrupt" still works too, as a manual backup, on both platforms.
//
// The two platforms' underlying echo-cancellation mechanisms differ (see
// each native file's own header comment for the full story), and that
// difference is what the barge-in effect below actually reacts to:
//   - iOS: a single AVAudioEngine does both playback and capture with
//     real, explicit voice-processing/echo cancellation, so a barge-in is
//     detected purely from a genuine new transcript arriving during the
//     'speaking' phase.
//   - Android (DuplexVoiceEngineModule.kt's "ROUND 2" rewrite): captures
//     via AudioRecord with AcousticEchoCanceler/NoiseSuppressor attached
//     directly to its own session (both optional, device-dependent
//     effects -- not a guarantee on every device, see that file's own
//     comment) and streams to this app's backend for real-time STT via
//     Deepgram. Deepgram's own VAD detects speech onset independently of
//     any transcript and is forwarded here as the onSpeechStarted event --
//     a materially FASTER barge-in signal than waiting for a transcript,
//     since it fires the instant the mic hears voice rather than once
//     enough of it has been transcribed. The barge-in effect below reacts
//     to EITHER signal; onSpeechStarted simply never fires on iOS, so
//     that platform's behavior is unaffected.
//
// REVERTED TWICE, then a working THIRD attempt — full history, because
// understanding why the first two failed is what made the third one
// possible:
//
// Attempt 1 (real-device report: "The AI voice is not talking even though
// its indicating that its speaking but i cant hear anything and its not
// even capturing my voice" — total silence AND a dead mic). Kept the mic
// running through TTS via speak()'s `preserveRecordingSession` option but
// never touched the iOS AVAudioSession's MODE, only its category — no
// echo cancellation was engaged, and the raw category-only session
// couldn't reliably do either half of simultaneous record+playback.
//
// Attempt 2 (real-device report: ElevenLabs voice gone AND "its listening
// to itself and answering itself" — the coach hearing and replying to its
// own TTS output). Added the missing piece from attempt 1 — a native
// patch (patches/@dev-amirzubair+react-native-voice+1.0.4.patch) setting
// AVAudioSessionModeVoiceChat, Apple's mode for concurrent record+playback
// with built-in echo cancellation — and it still didn't work. Two
// separate problems, both now understood:
//   1. ElevenLabs voice loss was actually just this file's own doing: the
//      speak() call sites all passed `preserveRecordingSession: true`,
//      and speak() (see speechService.ts) treats that flag as "skip
//      speakRemote (ElevenLabs) entirely, go straight to on-device TTS" —
//      that's Video mode's existing, deliberate behavior for protecting
//      VisionCamera's session, reused here for a different reason but
//      with the same effect. Not a bug in the new code, just an
//      unwelcome side effect of reusing that flag.
//   2. The self-listening loop is the real finding: AVAudioSessionMode's
//      built-in echo cancellation operates WITHIN a single AVAudioEngine's
//      voice-processing I/O unit — it cancels audio that the SAME engine
//      is rendering out, using that engine's own render callback as the
//      reference signal. It has no way to cancel audio that a DIFFERENT,
//      independent engine played. react-native-tts's on-device speech
//      (AVSpeechSynthesizer) and react-native-nitro-sound's ElevenLabs
//      playback both render through their own separate pipelines, not
//      through @dev-amirzubair/react-native-voice's capture engine —
//      setting the session-level mode was necessary but never sufficient
//      for these specific libraries to cancel each other out.
//
// Attempt 3 (THIS ONE — confirmed working on a real device): built the
// real fix attempt 2's own root-cause analysis called for — a from-scratch
// native module (DuplexVoiceEngine, see its own header comment for the
// full build/debug story) that owns ONE AVAudioEngine for both playback
// and capture, with voice processing explicitly enabled on both its
// input and output nodes, so the OS's echo canceller has an actual
// reference signal to work with. Built and proven in strict, isolated
// phases (on-device TTS + concurrent listening first, then ElevenLabs
// remote audio through the same engine — see src/dev/
// DuplexVoiceTestScreen.tsx) before ever being wired in here, per the
// discipline the first two failed attempts made clear was necessary.
// User-confirmed on a real device, in order: (1) "Yes the transcript
// picks up your actual words before it finishes" — proof the core
// duplex+echo-cancellation mechanism genuinely works — then (2) the same
// result with real ElevenLabs audio in place of on-device TTS. Android
// later got its own equivalent native module (DuplexVoiceEngineModule.kt)
// via a different mechanism (see this file's own header comment above),
// built and proven via src/dev/DuplexVoiceTestScreen.tsx first, same
// discipline this iOS build went through.
// BUG FIX (product request: "reduce the wait time. It needs to pick up my
// voice as quick as 1sec") -- this is the pause length the silence-based
// turn-detection effect below waits for after the transcript last changed
// before treating the user's turn as over and sending it. Was 1300ms;
// lowered to 1000ms as asked. Applies to both the duplex (iOS) and legacy
// (Android) paths equally, since both share this same debounce effect.
const SILENCE_DEBOUNCE_MS = 1000;

// BUG FIX (product report: "I waited up to like 5 minutes and it still did
// not capture my voice") — duplexVoiceService.start() (a native-module
// bridge promise, ios/caren_family/DuplexVoiceEngine.swift's own `start`
// handler) had no timeout of its own anywhere in this file. If that native
// promise never calls back its resolve/reject block for any reason — the
// exact class of bug utils/withTimeout.ts was originally built for (see its
// own header comment: "a native-module bridge promise... that never fires
// would hang that await forever") — the await below would hang indefinitely
// with phase stuck at its default 'idle' ("Starting…" on screen the whole
// time) and no error ever shown: indistinguishable from "just not working,"
// with zero signal to the user or to us. 20s is generous enough to cover
// real (if unusually slow) AVAudioSession/engine setup — confirmed
// resolving well under 1s on a real device under normal conditions — without
// leaving the user staring at "Starting…" for anywhere near the 5 minutes
// reported.
const DUPLEX_START_TIMEOUT_MS = 20000;

type Phase = 'listening' | 'thinking' | 'speaking' | 'idle';

const ORB_SIZE = 176;
const HALO_SIZE = ORB_SIZE * 1.5;

// Product request item: "the AI coach can ask the user if they want the
// coach to navigate to the specific screen for them... and the app will
// navigate automatically to that screen" — Text mode gets a tappable chip
// (see Chat.tsx's renderCustomView), but there's nothing to tap in Voice
// mode, so the coach instead asks out loud and this listens for a plain
// yes on the very next turn. Deliberately just a handful of common
// affirmatives per supported locale rather than a full NLU intent check —
// this only ever fires right after the coach itself asked a yes/no
// question, so the false-positive surface is small, and anything that
// doesn't match one of these is treated as "no" (i.e. falls through to a
// normal coaching turn instead of leaving the user stuck).
const AFFIRMATIVE_WORDS: Record<string, string[]> = {
  en: ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'please', 'go ahead', 'take me there', "let's do it"],
  es: ['si', 'sí', 'claro', 'vale', 'dale', 'por favor'],
  fr: ['oui', "d'accord", 'ok', 'vas-y', "s'il te plait", "s'il vous plait"],
  de: ['ja', 'klar', 'gerne', 'okay', 'ok'],
  it: ['si', 'sì', 'certo', 'va bene', 'ok', 'okay'],
  pt: ['sim', 'claro', 'vamos', 'ok', 'okay', 'por favor'],
  ru: ['да', 'конечно', 'давай', 'хорошо'],
  zh: ['是', '好', '好的', '可以', '去吧'],
  ja: ['はい', 'うん', 'お願いします', 'いいよ'],
  ko: ['네', '예', '좋아', '그래'],
  ar: ['نعم', 'اكيد', 'حسنا', 'تمام'],
  hi: ['हाँ', 'ठीक है', 'हां', 'चलो'],
};

// BUG FIX (product report: "if the AI career coach automatically ask if it
// should take me to a specific screen and i said no it still takes me
// there"). isAffirmative used to check `normalized.includes(w)` for EVERY
// word, including short, single words like "ok"/"okay"/"sure" -- a raw
// substring check, not a whole-word one. Natural spoken declines routinely
// contain one of those words as pure filler -- "No, that's okay" contains
// "okay"; "No, I'm good, sure I'll ask later" contains "sure" -- so a clear
// decline was being misread as a yes and auto-navigating the user anyway.
// Fixed for space-delimited languages (en/es/fr/de/it/pt/ru) two ways: (1)
// single words now only match as a whole token, not as a substring of a
// longer unrelated word or phrase; (2) an explicit negative-word list is
// checked FIRST, so a decline always wins even if an affirmative word also
// happens to appear elsewhere in the same sentence. The CJK/Arabic/Hindi
// lists (zh/ja/ko/ar/hi) are deliberately left on the original substring
// approach -- those scripts don't reliably use spaces to separate words, so
// naive whole-token splitting would make them worse, not better (a whole
// run of, say, Chinese characters with no spaces becomes one unsplittable
// "token," so a short legitimate reply embedded in a longer sentence would
// stop matching at all). Multi-word phrases ("go ahead", "take me there")
// still match via substring in every language -- distinctive enough that
// this isn't the same false-positive risk short single words carry.
const NEGATIVE_WORDS: Record<string, string[]> = {
  en: ['no', 'nope', 'nah', "don't", 'dont', 'not now', 'never mind', 'nevermind', 'not really', 'no thanks', 'not yet'],
  es: ['no', 'nunca', 'para nada', 'ahora no'],
  fr: ['non', 'pas maintenant', 'jamais'],
  de: ['nein', 'niemals', 'jetzt nicht'],
  it: ['no', 'mai', 'non ora'],
  pt: ['não', 'nao', 'nunca', 'agora não'],
  ru: ['нет', 'не сейчас', 'никогда'],
};
const WORD_TOKENIZED_LANGS = new Set(['en', 'es', 'fr', 'de', 'it', 'pt', 'ru']);
// Splits on anything that ISN'T a basic Latin/Latin-1/Cyrillic letter,
// digit, or apostrophe (apostrophes are kept IN tokens -- "don't"/
// "d'accord"/"let's do it" all rely on them) -- deliberately a plain
// character class rather than a `\p{Letter}` Unicode property escape, to
// avoid depending on `/u`-flag Unicode property support in Hermes.
const WORD_SPLIT_RE = /[^a-zà-ÿ0-9а-яё']+/;
const matchesAnyWord = (normalized: string, words: string[], wholeWord: boolean): boolean => {
  if (!wholeWord) return words.some(w => normalized.includes(w));
  const tokens = normalized.split(WORD_SPLIT_RE).filter(Boolean);
  return words.some(w => (w.includes(' ') ? normalized.includes(w) : tokens.includes(w)));
};
const isAffirmative = (text: string, language: string): boolean => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  const lang = language?.split('-')[0] ?? 'en';
  const wholeWord = WORD_TOKENIZED_LANGS.has(lang);
  const negativeWords = NEGATIVE_WORDS[lang];
  if (negativeWords && matchesAnyWord(normalized, negativeWords, wholeWord)) return false;
  const words = AFFIRMATIVE_WORDS[lang] ?? AFFIRMATIVE_WORDS.en;
  return matchesAnyWord(normalized, words, wholeWord);
};

const VoiceCoachView = memo(({
  userContext,
  onSuggestedAction,
  initialTopic,
  onInitialTopicHandled,
  active,
}: {
  userContext?: CoachUserContext;
  // Fired once the user affirms the coach's spoken offer — Chat.tsx passes
  // down the same handler its "Learn more about X"-style chip uses in Text
  // mode (onRunSuggestedAction), so both modes navigate identically.
  onSuggestedAction?: (action: SuggestedActionId) => void;
  // Product follow-up: "[the suggested topics] should be in the screen
  // that leads to the live conversation screen" / confirmed: tapping one
  // should start a real spoken conversation about it, not just drop a
  // text bubble. Chat.tsx's greeting screen switches into Voice mode and
  // passes the tapped topic's title down here — see the active-driven
  // effect below for what "starting the conversation with it" actually
  // does.
  initialTopic?: string;
  // Fired once initialTopic has been consumed (sent as the opening turn)
  // so Chat.tsx can clear it — otherwise re-engaging Voice mode again
  // later would replay the same stale topic as a new turn.
  onInitialTopicHandled?: () => void;
  // BUG FIX (product report: "the AI career coach take[s] a long time to
  // capture the users voice unlike before... once it opens the user can
  // begin talking") -- Chat.tsx used to unmount this component entirely
  // whenever Text mode was selected, which tore down and fully rebuilt
  // the native duplex engine (real AVAudioSession + echo-canceller setup,
  // measurably heavier than the old simple pipeline) on every single
  // Voice<->Text toggle, not just on leaving the Coach screen. Chat.tsx
  // now keeps this component mounted continuously for as long as the
  // Coach screen itself is open, in either mode, and passes `active` down
  // instead: true only while Voice mode is the one actually on screen,
  // false while Text mode is showing but this component is still mounted
  // (hidden) underneath it. See hasEngagedRef's own comment below for how
  // this drives the engine's start-once/pause/resume lifecycle -- product-
  // approved tradeoff: the mic stays live (and the OS's mic-in-use
  // indicator stays on) for as long as Voice mode has been engaged at
  // least once during this Coach screen visit, not just while Voice
  // mode's UI is actually the one on screen.
  active: boolean;
}) => {
  const { t } = useTranslation(['message']);
  const theme = useTheme();
  const { theme: appTheme } = React.useContext(ThemeContext);
  const isDarkMode = appTheme === 'dark';

  // Real speak-to-interrupt (see the header comment above) is iOS-only for
  // now. isDuplexVoiceSupported() USED TO be read as a plain const here,
  // on the assumption that it's stable for the app's whole lifetime once
  // read once. That assumption broke a real case (see the state + effect
  // right below): a genuinely stable per-render CONST can't ever prompt a
  // re-render on its own once its underlying answer changes, so this is
  // now state instead, seeded with whatever the very first check returns.
  const [duplexSupported, setDuplexSupported] = React.useState(() => duplexVoiceService.isDuplexVoiceSupported());

  // BUG FIX (product report: "when we go to the chat and i try talking it
  // does not capture my voice instantly unless i navigate to another page
  // and then come back"). duplexVoiceService.ts's own native-module lookup
  // is now lazy and retry-capable (see that file's own fix) instead of
  // permanently caching an early `null` -- but nothing was actually
  // RE-TRIGGERING that lookup on its own. `duplexSupported` above used to
  // be read once as a plain const on whatever the FIRST render happened to
  // be, and every effect that depends on it (including the one below that
  // actually engages Voice mode) only re-runs when a value IN ITS
  // DEPENDENCY ARRAY changes -- a later successful resolution inside
  // duplexVoiceService.ts is invisible to React entirely unless something
  // here re-checks it AND stores the new answer as real state. Right after
  // a cold app launch (this screen mounting for the very first time in a
  // fresh process, exactly the case most likely to race the native bridge
  // -- see duplexVoiceService.ts's own fix for why), the very first tap
  // into Voice mode could still catch `duplexSupported` still false,
  // silently falling back to the legacy react-native-voice pipeline for
  // that attempt. Navigating away and back happened to "fix" it only as a
  // side effect of the focusGeneration fix above forcing a full
  // re-engagement later, by which point the bridge had caught up -- not
  // because leaving and returning does anything meaningful on its own.
  // This closes the actual gap: briefly re-checks isDuplexVoiceSupported()
  // on a short timer right after mount, ONLY while it's still false, and
  // commits a real state update (triggering an actual re-render, and thus
  // every dependent effect) the moment it flips true. 150ms x 20 tries is
  // 3s of real headroom -- comfortably longer than the bridge-registration
  // race takes to resolve, comfortably shorter than any realistic human
  // reaction time to actually tap into Voice mode and start talking, so in
  // practice this closes the window before the user could ever hit it.
  React.useEffect(() => {
    if (Platform.OS !== 'ios' || duplexSupported) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (duplexVoiceService.isDuplexVoiceSupported()) {
        if (__DEV__) console.warn('[VoiceCoachView] duplex support resolved true after', attempts, 'recheck(s)');
        setDuplexSupported(true);
        clearInterval(timer);
        return;
      }
      if (attempts >= 20) clearInterval(timer);
    }, 150);
    return () => clearInterval(timer);
  }, [duplexSupported]);

  // Legacy pipeline — always constructed (rules of hooks require it), but
  // its start()/stop()/reset() are only ever actually invoked below when
  // !duplexSupported. On iOS this hook's internal state just sits unused.
  const stt = speechService.useSpeechToText();

  const [phase, setPhase] = React.useState<Phase>('idle');
  const [lastCoachLine, setLastCoachLine] = React.useState(
    t('message:voice_initial_line', {
      defaultValue: "I'm listening — talk to me whenever you're ready.",
    }),
  );
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const phaseRef = React.useRef<Phase>('idle');
  React.useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Mirrors the `active` prop for the same reason phaseRef mirrors phase —
  // read inside listener closures (the duplex event listeners, the
  // AppState handler) that are set up once and would otherwise close over
  // a stale value of `active` from whatever render they were created in.
  const activeRef = React.useRef(active);
  React.useEffect(() => {
    activeRef.current = active;
  }, [active]);

  // True once Voice mode has been engaged (active became true) at least
  // once during this component's current mount — NOT reset when toggling
  // back to Text mode, only on a genuine unmount (leaving the Coach screen
  // entirely). Drives the active-driven effect below: the FIRST time
  // active becomes true, it runs the full original mount sequence (start
  // the engine, speak the intro or initialTopic, start listening); every
  // time after that, active becoming true again is just a resume (the
  // engine never stopped) and active becoming false is just a pause, not
  // a teardown.
  const hasEngagedRef = React.useRef(false);

  // BUG FIX (product report: "when I navigate away from the AI career coach
  // screen and then come back to it just stops capturing my voice"). The
  // screen-level useFocusEffect below tears the duplex engine all the way
  // down on BLUR (resetting hasEngagedRef/duplexStartedRef to false) --
  // that's correct, it's meant to fully release the mic when the user
  // leaves the Coach screen. The bug is what happens on the way BACK: the
  // effect that actually restarts the engine only reacts to the `active`
  // prop CHANGING (deps `[active]`). If the user was already in Voice mode
  // when they navigated away, `active` is true before they leave and still
  // true the moment they return -- it never changes at all across that
  // round trip -- so nothing ever re-fires that effect, and the engine
  // that blur just tore down is never restarted. Bumped once on every
  // focus/re-focus (see the useFocusEffect below) and added to that
  // effect's own dependency array so a refocus ALWAYS re-evaluates it
  // regardless of whether `active` itself changed -- since hasEngagedRef
  // was just reset by the preceding blur, that re-evaluation correctly
  // falls into the same "first engagement" branch as a fresh mount would,
  // genuinely restarting the engine instead of assuming it's still alive.
  const [focusGeneration, setFocusGeneration] = React.useState(0);

  const silenceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActiveRef = React.useRef(false);
  // Set right after the coach speaks a "want me to take you there?" offer;
  // checked (and always cleared) at the start of the very next turn.
  const pendingActionRef = React.useRef<SuggestedActionId | null>(null);
  // Bumped on every duplex speak (a normal reply, the intro, or a
  // pending-action confirmation) and on any interrupt (manual tap or auto
  // barge-in). speakDuplexFireAndForget's own failure handler checks this
  // before surfacing an error, so a genuinely-superseded call (the coach
  // got cut off on purpose) never reports a spurious "couldn't play that
  // out loud" for something that was deliberately stopped.
  const turnTokenRef = React.useRef(0);
  // Whether duplexVoiceService.start() has already been called for the
  // CURRENT foreground session. start() only ever needs to run once per
  // session — the engine + recognition then run continuously through
  // every turn, including while the coach is speaking (that's the whole
  // point) — reset to false on background/unmount so returning to the
  // screen (or the app) does a clean restart instead of assuming a
  // possibly-torn-down engine is still alive.
  const duplexStartedRef = React.useRef(false);
  // One-shot callback to run instead of the default "go back to
  // listening" once the coach finishes speaking (see the onSpeakingState
  // listener below) — used for the pending-action confirmation line,
  // where "finishes speaking" should navigate away rather than resume
  // listening on a screen that's about to be left.
  const postSpeechActionRef = React.useRef<(() => void) | null>(null);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  // --- Duplex-only transcript accumulation -----------------------------
  // DuplexVoiceEngine.swift's own recognition loop restarts a fresh
  // SFSpeechAudioBufferRecognitionRequest on every isFinal/error to keep
  // "always listening" alive across the recognizer's internal session
  // length limit (see that file's startRecognitionRequest comment) — each
  // new request's transcript starts over from empty. Naively replacing a
  // local `transcript` string with whatever the latest onTranscript event
  // carries would make the on-screen transcript, and the silence-based
  // turn-completion timer below (which keys off transcript CHANGING),
  // jump backward to nothing mid-sentence whenever that internal restart
  // happens — not just when the user's turn genuinely ends. duplexSegment
  // holds the CURRENT request's live text; duplexCommittedRef accumulates
  // every PRIOR segment of the current turn so it survives that restart.
  // The two are joined into a single `transcript` value below for
  // everything else in this screen to read, exactly like `stt.transcript`
  // was on the legacy path.
  const duplexCommittedRef = React.useRef('');
  const [duplexSegment, setDuplexSegment] = React.useState('');

  // Android-only fast barge-in signal (see this file's own header comment
  // and duplexVoiceService.ts's SpeechStartedEvent) -- a counter, not a
  // boolean, purely so the barge-in effect below can tell "a NEW
  // speech-started event just arrived" apart from "nothing changed," the
  // same way duplexSegment's own text changing (rather than merely being
  // non-empty) is what that effect already keys off of. Never increments
  // on iOS -- onSpeechStarted simply doesn't exist there.
  const [speechStartedPulse, setSpeechStartedPulse] = React.useState(0);
  // See the barge-in effect below for exactly what this tracks and why.
  const prevSpeechStartedPulseRef = React.useRef(0);

  const resetDuplexTranscript = React.useCallback(() => {
    duplexCommittedRef.current = '';
    setDuplexSegment('');
  }, []);

  React.useEffect(() => {
    if (!duplexSupported) return;
    // DIAGNOSTIC (product report: coach screen isn't picking up any speech
    // at all after the duplex engine was wired in, with no visible error —
    // same class of "silently nothing happens" report this codebase has
    // hit before, e.g. speechService.ts's own recentErrorTimestampsRef
    // history). This screen and src/dev/DuplexVoiceTestScreen.tsx run the
    // exact same duplexVoiceService calls, but the test screen is a
    // standalone route with nothing else mounted alongside it, while this
    // one lives embedded inside Chat.tsx's Voice/Text mode toggle — if
    // something about that embedding (a remount, a competing audio-session
    // user, etc.) is the actual difference, these logs are what will show
    // it on the next real-device test, instead of guessing blind again.
    if (__DEV__) console.warn('[VoiceCoachView] duplex listeners attached');
    const subs = [
      duplexVoiceService.addTranscriptListener(e => {
        if (__DEV__) console.warn('[VoiceCoachView] onTranscript', JSON.stringify(e));
        // BUG FIX (see the `active` prop's own comment) -- the native
        // engine now keeps transcribing continuously even while Text mode
        // is showing (Voice mode merely inactive, not torn down). Ignoring
        // events here while inactive stops incidental background speech
        // from silently building up in duplexCommittedRef/duplexSegment
        // and then getting treated as a real turn the moment the user
        // switches back to Voice mode — resetDuplexTranscript() in the
        // active-driven effect below also clears out anything that DID
        // sneak in before this guard, as a second layer of protection.
        if (!activeRef.current) return;
        setDuplexSegment(e.text);
        if (e.isFinal) {
          duplexCommittedRef.current = (duplexCommittedRef.current + ' ' + e.text).trim();
          setDuplexSegment('');
        }
      }),
      // Single source of truth for "the coach is done talking" — fires
      // reliably whether that's because the reply finished naturally OR
      // because stopSpeaking() cut it off (manual tap or auto barge-in).
      // See sendTurn's own comment on why nothing here is driven by
      // awaiting the speak() call's promise instead.
      duplexVoiceService.addSpeakingStateListener(e => {
        if (__DEV__) console.warn('[VoiceCoachView] onSpeakingState', JSON.stringify(e), 'phase=', phaseRef.current);
        if (e.speaking) return;
        // Inactive (Text mode showing) -- the active-driven effect below
        // already force-stopped speech and set phase to 'idle' the moment
        // this became inactive, so there's nothing left for this listener
        // to do; without this guard a speaking-finished event racing that
        // transition could clobber phase back to 'listening' while Text
        // mode is on screen.
        if (!activeRef.current) return;
        if (phaseRef.current !== 'speaking') return;
        const postAction = postSpeechActionRef.current;
        postSpeechActionRef.current = null;
        if (postAction) {
          postAction();
          return;
        }
        setPhase('listening');
      }),
      duplexVoiceService.addErrorListener(e => {
        if (__DEV__) console.warn('[VoiceCoachView] onError', JSON.stringify(e));
        if (isActiveRef.current) setErrorMsg(e.message);
      }),
      // Android-only (see speechStartedPulse's own comment) -- a no-op
      // subscription on iOS, since DuplexVoiceEngine.swift never emits
      // this event.
      duplexVoiceService.addSpeechStartedListener(() => {
        if (__DEV__) console.warn('[VoiceCoachView] onSpeechStarted');
        if (!activeRef.current) return;
        setSpeechStartedPulse(p => p + 1);
      }),
    ];
    return () => subs.forEach(sub => sub?.remove());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplexSupported]);

  const transcript = duplexSupported
    ? (duplexCommittedRef.current + ' ' + duplexSegment).trim()
    : stt.transcript;

  // Surfaces speechService's rapid-error-loop detector (legacy path
  // only — the duplex path has its own addErrorListener above, wired to
  // DuplexVoiceEngine's equivalent rapid-error-loop guard).
  React.useEffect(() => {
    if (duplexSupported) return;
    if (stt.error && isActiveRef.current) {
      setErrorMsg(stt.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stt.error, duplexSupported]);

  const startListening = React.useCallback(async () => {
    setErrorMsg(null);
    if (duplexSupported) {
      // The engine + recognition are already running continuously
      // (started once at mount / on foreground-return — see the focus and
      // AppState effects below) — "starting to listen" for a new turn is
      // just a UI-phase change here, not a new native call.
      setPhase('listening');
      return;
    }
    stt.reset();
    const ok = await stt.start();
    if (ok) {
      setPhase('listening');
    } else {
      setErrorMsg(
        stt.error ??
          i18n.t('message:voice_mic_error', { defaultValue: 'Could not start the microphone.' }),
      );
      setPhase('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplexSupported]);

  // Fires the real ElevenLabs-with-fallback voice through the duplex
  // engine WITHOUT awaiting it for control flow. This is deliberate, not
  // an oversight: DuplexVoiceEngine.stopSpeaking() (called by the
  // barge-in effect below, or by a manual tap via onInterrupt) bumps its
  // own internal generation counter, which permanently blocks the
  // ORIGINAL speak()/speakRemoteAudio() call's completion callback from
  // ever firing resolve() — so awaiting it here would mean an interrupted
  // call's caller never continues at all. The onSpeakingState listener
  // above is the single source of truth for "the coach is done talking"
  // instead, and drives whatever should happen next on its own; this
  // helper only needs to kick playback off and report a genuine total
  // failure (both the real voice AND the on-device fallback failing).
  const speakDuplexFireAndForget = React.useCallback((text: string) => {
    turnTokenRef.current += 1;
    const myToken = turnTokenRef.current;
    duplexVoiceService.speakWithFallback(text).catch(() => {
      if (myToken === turnTokenRef.current && isActiveRef.current) {
        setErrorMsg(
          i18n.t('message:voice_speak_failed', {
            defaultValue: "Couldn't play that out loud — the text reply above is still there.",
          }),
        );
      }
    });
  }, []);

  const sendTurn = React.useCallback(
    async (finalText: string) => {
      const trimmed = finalText.trim();
      if (!trimmed) {
        setPhase('listening');
        return;
      }
      // Consume the duplex transcript buffer right when a turn is taken
      // from it, regardless of call site (live silence-detection, the
      // initial topic, etc.) — so leftover words never bleed into the
      // NEXT turn or get mistaken for a barge-in the moment 'speaking'
      // starts below.
      if (duplexSupported) resetDuplexTranscript();

      // Resolve any pending "want me to take you there?" offer from the
      // previous turn before treating this as a fresh coaching question —
      // a plain yes here should navigate, not get sent to the LLM.
      const pendingAction = pendingActionRef.current;
      pendingActionRef.current = null;
      if (pendingAction) {
        if (isAffirmative(trimmed, i18n.language)) {
          const confirmLine = i18n.t('message:voice_action_confirm_line', {
            defaultValue: 'Great, taking you there now.',
          });
          setLastCoachLine(confirmLine);
          setPhase('speaking');
          if (duplexSupported) {
            postSpeechActionRef.current = () => {
              if (isActiveRef.current) onSuggestedAction?.(pendingAction);
            };
            speakDuplexFireAndForget(confirmLine);
            return;
          }
          await stt.stop();
          try {
            await speechService.speak(confirmLine);
          } catch {
            // best-effort
          }
          if (!isActiveRef.current) return;
          onSuggestedAction?.(pendingAction);
          return;
        }
        // Anything other than a clear yes falls through and is sent as a
        // normal turn below — treated as "no, but here's what I actually
        // wanted to say" rather than a dead end.
      }

      setPhase('thinking');
      let replyText = '';
      let suggestedAction: SuggestedActionId | undefined;
      try {
        const result = await coachService.sendVoiceMessage(trimmed, userContext);
        replyText = result.coachMessage.text;
        suggestedAction = result.coachMessage.suggestedAction;
      } catch (e: any) {
        replyText = i18n.t('message:voice_retry_line', {
          defaultValue: "Sorry, I didn't catch that — could you say it again?",
        });
        setErrorMsg(e?.message ?? null);
      }
      if (suggestedAction) {
        // Was a per-action hand-written full sentence (4 of them, hardcoded
        // here) — now one generic template naming the destination via the
        // shared registry's title, so a new action (see
        // services/suggestedActions.ts) never needs a new sentence written
        // here by hand.
        const offer = i18n.t('message:voice_action_offer_generic', {
          defaultValue: 'Want me to take you to {{title}}?',
          title: actionTitle(suggestedAction),
        });
        replyText = `${replyText} ${offer}`;
        pendingActionRef.current = suggestedAction;
      }
      if (!isActiveRef.current) return;
      setLastCoachLine(replyText);
      setPhase('speaking');

      if (duplexSupported) {
        // Mic never stopped — no restart needed. The onSpeakingState
        // listener above takes phase back to 'listening' on its own once
        // this genuinely finishes (or gets barged into).
        speakDuplexFireAndForget(replyText);
        return;
      }

      await stt.stop();
      let spokeFailed = false;
      try {
        await speechService.speak(replyText);
      } catch {
        // speak() already falls back to on-device TTS internally on a
        // remote failure -- reaching this catch means BOTH the real voice
        // AND the on-device fallback failed, i.e. genuinely nothing was
        // ever spoken out loud (product report: "the AI coach isn't
        // talking at all"). That used to be swallowed silently here, which
        // is exactly why it looked like nothing happened at all in Voice
        // mode -- lastCoachLine/displayLine above still updates with the
        // reply text regardless, but Voice mode is meant to be hands-free,
        // so a user not looking at the screen got no signal whatsoever
        // that anything had gone wrong. Surfacing it here at least makes
        // the failure visible (and gives us something concrete to go on
        // if it's reported again) instead of it just looking broken.
        spokeFailed = true;
        if (isActiveRef.current) {
          setErrorMsg(
            i18n.t('message:voice_speak_failed', {
              defaultValue: "Couldn't play that out loud — the text reply above is still there.",
            }),
          );
        }
      }
      if (!isActiveRef.current) return;
      if (spokeFailed) {
        // startListening() clears errorMsg as its very first line (correct
        // for a stale mic-start error) -- without this pause it would wipe
        // the message this catch block JUST set before it had any chance
        // to actually be seen, since the restart below fires immediately.
        // The mic isn't blocked from re-arming by this, it's just given a
        // moment to be readable first.
        await new Promise(resolve => setTimeout(resolve, 2500));
        if (!isActiveRef.current) return;
      }
      startListening();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userContext, onSuggestedAction, duplexSupported],
  );

  React.useEffect(() => {
    // BUG FIX (see the `active` prop's own comment) -- this component now
    // stays mounted while Text mode is showing, so this turn-completion
    // timer must not fire for background speech picked up while inactive.
    if (!active) return;
    if (phase !== 'listening') return;
    clearSilenceTimer();
    if (!transcript.trim()) return;
    silenceTimerRef.current = setTimeout(() => {
      if (phaseRef.current !== 'listening') return;
      const finalText = transcript;
      if (!duplexSupported) stt.reset();
      sendTurn(finalText);
    }, SILENCE_DEBOUNCE_MS);
    return clearSilenceTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, phase, active]);

  // Diagnostic nudge (product report: "it shows I'm listening, I say
  // something, and nothing happens" -- with no error shown, meaning
  // stt.start() itself succeeded and the mic never reported a failure). The
  // debounce effect above only ever fires sendTurn() once transcript (state,
  // not a live ref) has actually changed -- if the native speech recognizer
  // genuinely never delivers a result back for this session, transcript
  // just never changes and NOTHING in this screen ever tells the user
  // that. This doesn't fix that underlying capture issue (a JS-only fix
  // can't -- there's no signal to react to if the native side never calls
  // back at all), but it stops the screen from silently sitting there
  // forever with zero feedback: after a long stretch of "listening" with
  // nothing ever recognized, nudge the user rather than leaving them
  // wondering whether the app heard them at all.
  React.useEffect(() => {
    if (!active) return;
    if (phase !== 'listening') return;
    const timer = setTimeout(() => {
      if (phaseRef.current === 'listening' && !transcript.trim()) {
        setErrorMsg(
          i18n.t('message:voice_no_speech_nudge', {
            defaultValue: "Still there? I'm not picking up anything — try tapping the orb, or check your mic.",
          }),
        );
      }
    }, 20000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, active]);

  const onInterrupt = React.useCallback(async () => {
    if (phaseRef.current !== 'speaking') return;
    if (duplexSupported) {
      turnTokenRef.current += 1; // supersede speakDuplexFireAndForget's own pending call
      setPhase('listening'); // optimistic, immediate UI feedback for a manual tap
      await duplexVoiceService.stopSpeaking().catch(() => {});
      return;
    }
    // BUG FIX (see speechService.stopSpeaking's own comment on this round's
    // fresh "captures fine in Mock Interview, never in Coach" report) —
    // stopSpeaking() is now a genuinely awaitable teardown instead of
    // fire-and-forget; awaiting it here means startListening()'s own 700ms
    // settle delay starts counting from a *confirmed* stop instead of
    // racing an in-flight one on top of it.
    await speechService.stopSpeaking();
    startListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplexSupported]);

  // Real speak-to-interrupt: thanks to DuplexVoiceEngine's shared-engine
  // echo cancellation (confirmed on a real device — see this file's header
  // comment for the full three-attempt history), a transcript arriving
  // here WHILE the coach is talking is the user's own voice, not the
  // coach's own TTS being picked back up. Cut the coach off immediately
  // and hand the turn back — same effect as tapping the orb via
  // onInterrupt, just triggered by speech instead of a tap.
  //
  // Reacts to EITHER of two independent signals now (see this file's own
  // header comment on the two platforms' mechanisms):
  //   - a non-empty live transcript (both platforms)
  //   - speechStartedPulse changing (Android only) — Deepgram's own VAD
  //     detecting speech onset, which arrives BEFORE any transcript text
  //     does, so this cuts the coach off sooner on Android than waiting
  //     for a transcript alone ever could.
  // prevSpeechStartedPulseRef tracks "the pulse value as of the last time
  // this effect ran" (not "the value it last acted on") specifically so a
  // pulse that arrives while phase !== 'speaking' (e.g. during ordinary
  // listening, where onSpeechStarted also fires — see
  // DuplexVoiceEngineModule.kt's emitSpeechStarted) gets marked as "seen"
  // here even though this effect takes no action on it, rather than
  // wrongly looking "fresh" again the next time phase becomes 'speaking'
  // for an unrelated later turn.
  React.useEffect(() => {
    const freshSpeechStarted = speechStartedPulse !== prevSpeechStartedPulseRef.current;
    prevSpeechStartedPulseRef.current = speechStartedPulse;
    if (!duplexSupported) return;
    if (!active) return;
    if (phase !== 'speaking') return;
    const liveText = (duplexCommittedRef.current + ' ' + duplexSegment).trim();
    if (!liveText && !freshSpeechStarted) return;
    turnTokenRef.current += 1; // supersede speakDuplexFireAndForget's own pending call
    setPhase('listening');
    duplexVoiceService.stopSpeaking().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplexSupported, phase, duplexSegment, active, speechStartedPulse]);

  // Screen-level lifecycle ONLY now — starting the engine and the
  // intro/topic/listen sequence moved to the active-driven effect below
  // (see `active`/hasEngagedRef's own comments for why). This still owns
  // the one thing that genuinely should only happen on leaving the whole
  // Coach screen (or the initial mount of it): isActiveRef's true/false
  // state-update-safety guard, and the FULL engine teardown on blur/
  // unmount — real backgrounding is handled separately by the AppState
  // effect further below.
  useFocusEffect(
    React.useCallback(() => {
      isActiveRef.current = true;
      // See focusGeneration's own comment above -- this is what lets the
      // active-driven effect below tell "the screen just refocused" apart
      // from "nothing happened," even when `active` itself didn't change
      // across the round trip.
      setFocusGeneration(g => g + 1);
      if (__DEV__ && duplexSupported) console.warn('[VoiceCoachView] focus effect running (mount or re-focus)');
      return () => {
        // DIAGNOSTIC: if this fires shortly after mount without the user
        // navigating away, that's a real remount/re-focus of this screen
        // tearing the engine down mid-conversation -- exactly the kind of
        // thing that would look like "not capturing my voice at all" with
        // no error ever shown (stop() doesn't set errorMsg). Distinct from
        // duplexVoiceService.start()/onTranscript/onSpeakingState/onError
        // logs above, which only cover the ENGINE's own lifecycle, not
        // whether something in Chat.tsx is remounting this component.
        if (__DEV__ && duplexSupported) console.warn('[VoiceCoachView] focus-effect cleanup running (unmount or re-focus)');
        isActiveRef.current = false;
        clearSilenceTimer();
        if (duplexSupported) {
          duplexStartedRef.current = false;
          hasEngagedRef.current = false;
          duplexVoiceService.stop().catch(() => {});
        } else {
          stt.stop();
          speechService.stopSpeaking();
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // BUG FIX (product report: "the AI career coach take[s] a long time to
  // capture the users voice unlike before... once it opens the user can
  // begin talking") — this is the effect that actually engages/pauses/
  // resumes Voice mode, driven by the `active` prop instead of this whole
  // component's own mount/focus (see that prop's own comment for the full
  // "why" — Chat.tsx now keeps this component mounted continuously across
  // Voice<->Text toggles instead of unmounting it, specifically so this
  // effect firing on a toggle is cheap: no native engine work at all,
  // just a phase change).
  React.useEffect(() => {
    if (!active) {
      // Leaving Voice mode for Text mode (or simply never engaged it this
      // visit — the untouched early-return below covers that). Stop the
      // coach talking if it was mid-reply and stop reacting to transcripts
      // (see the duplex listeners' own activeRef guards above) — but
      // deliberately does NOT touch the engine/mic themselves, which is
      // the entire point of this fix.
      if (!hasEngagedRef.current) return;
      clearSilenceTimer();
      if (duplexSupported) {
        if (phaseRef.current === 'speaking') {
          turnTokenRef.current += 1; // supersede speakDuplexFireAndForget's own pending call
          duplexVoiceService.stopSpeaking().catch(() => {});
        }
      } else {
        // Android/legacy has no persistent engine to protect — pausing
        // here means a genuine stop, same as this screen's pre-existing
        // behavior on unmount.
        stt.stop();
        speechService.stopSpeaking();
      }
      setPhase('idle');
      return;
    }
    // active === true.
    // BUG FIX (product report: "I waited up to like 5 minutes and it still
    // did not capture my voice") -- this used to treat ANY prior engagement
    // (hasEngagedRef.current alone) as "the engine is already up, just
    // resume." But if the FIRST attempt to start the duplex engine (below)
    // ever failed or timed out, duplexStartedRef.current stays false
    // forever, and every later toggle back into Voice mode was silently
    // treated as a safe resume (just a phase change, no native call)
    // instead of actually retrying the real engine start -- so once the
    // first attempt failed, nothing the user did (including toggling back
    // and forth, exactly what they'd naturally try) could ever recover.
    // Now only treated as a safe resume once the engine has actually
    // confirmed started at least once (duplexStartedRef.current); otherwise
    // this falls through to the real start attempt below, same as a
    // first-ever engagement.
    if (hasEngagedRef.current && (!duplexSupported || duplexStartedRef.current)) {
      // Re-entering Voice mode after a toggle within this same screen
      // visit. Duplex: the engine never stopped, so this is just a phase
      // change, not a native call — clear out anything that sneaked into
      // the transcript buffer while inactive first (see the transcript
      // listener's own activeRef guard for the first layer of this same
      // protection). Legacy: startListening() below does a real restart,
      // same as it always has.
      if (duplexSupported) resetDuplexTranscript();
      if (isActiveRef.current) startListening();
      return;
    }
    hasEngagedRef.current = true;
    if (__DEV__ && duplexSupported) console.warn('[VoiceCoachView] engaging Voice mode for the first time this visit');
    (async () => {
      if (duplexSupported && !duplexStartedRef.current) {
        try {
          // See DUPLEX_START_TIMEOUT_MS's own comment above -- races the
          // real native start() against a plain timer instead of awaiting
          // it unconditionally, so a hung native promise surfaces a real
          // error instead of leaving the screen silently stuck on
          // "Starting…". Promise.race attaches a handler to BOTH promises
          // it's given (same guarantee utils/withTimeout.ts's own comment
          // documents), so a late resolve/reject from the losing side here
          // never produces an unhandled-rejection warning.
          let timedOut = false;
          await Promise.race([
            duplexVoiceService.start(),
            new Promise<void>(resolve => {
              setTimeout(() => {
                timedOut = true;
                resolve();
              }, DUPLEX_START_TIMEOUT_MS);
            }),
          ]);
          if (timedOut) {
            // Cast: i18n.t()'s TS return type is `DefaultTFuncReturn`
            // (string | null) even though a defaultValue guarantees a real
            // string back at runtime -- Error's constructor wants a plain
            // string, same minor type-vs-runtime gap this codebase already
            // works around elsewhere (e.g. HomeSrc.tsx's `.toString()` on
            // several `t()` calls passed to props typed as plain string).
            throw new Error(
              i18n.t('message:voice_mic_start_timeout', {
                defaultValue: 'Voice mode is taking too long to start. Please try again.',
              }) as string,
            );
          }
          duplexStartedRef.current = true;
          if (__DEV__) console.warn('[VoiceCoachView] duplexVoiceService.start() resolved');
        } catch (e: any) {
          if (__DEV__) console.warn('[VoiceCoachView] duplexVoiceService.start() rejected/timed out', e?.message ?? e);
          if (isActiveRef.current) {
            setErrorMsg(
              e?.message ??
                i18n.t('message:voice_mic_error', { defaultValue: 'Could not start the microphone.' }),
            );
            setPhase('idle');
          }
          // Best-effort: whether this was a real rejection or the timeout
          // above firing while start() was still in flight (which may yet
          // resolve "successfully" on the native side after the fact),
          // force a clean teardown so the NEXT attempt (toggling back to
          // Voice mode retries this whole block -- see the
          // hasEngagedRef/duplexStartedRef check above) starts from a known
          // state instead of layering a second start() on top of one that
          // might still be mid-flight.
          duplexVoiceService.stop().catch(() => {});
          return; // nothing else here can work without the engine
        }
      }
      // Product follow-up: a suggested topic tapped on the greeting
      // screen switches Chat.tsx into Voice mode and hands the topic's
      // title down as initialTopic — start the real live conversation
      // with it immediately (thinking -> a real spoken reply -> back to
      // listening, exactly like any other turn — see sendTurn below),
      // instead of the usual "wait for the user to speak first" open.
      // Skips the first-ever-visit intro entirely: sendTurn's own reply
      // already gives the user something spoken to react to, so a
      // separate generic greeting first would just be two lines of
      // speech back to back before the user gets to the thing they
      // actually tapped.
      if (initialTopic) {
        onInitialTopicHandled?.();
        if (isActiveRef.current) await sendTurn(initialTopic);
        return;
      }
      // BUG FIX (product report: "I want the AI coach to always
      // introduce itself for the first time the user is coming to the
      // app... the AI should introduce itself as Saveur") — Text mode
      // already shows this via coachService's greeting bubble; Voice
      // mode never spoke anything at all until the user said something
      // first. isFirstEverCoachVisit checks real persisted history (not
      // a per-screen-visit flag), so this only ever speaks once total —
      // it won't repeat on a later visit to Voice mode, including if the
      // user's very first coach interaction happened in Text mode
      // instead.
      let introSpeakFailed = false;
      // BUG FIX (real-device report: coach screen not picking up any
      // speech at all after the duplex engine was wired in). This used
      // to check `phaseRef.current !== 'speaking'` a few lines below to
      // decide whether an intro was just spoken -- but phaseRef only
      // gets updated by a SEPARATE effect (`phaseRef.current = phase`)
      // that runs on the NEXT render, not synchronously alongside the
      // `setPhase('speaking')` call right below. Since nothing in this
      // duplex branch awaits between that setPhase() call and the check
      // (speakDuplexFireAndForget is deliberately fire-and-forget, see
      // its own comment), phaseRef.current was still whatever it was
      // BEFORE this function ran (typically 'idle') at the time of that
      // check -- so it incorrectly looked like no intro had been spoken,
      // called startListening() immediately, and flipped phase straight
      // to 'listening' while the intro was still actually playing. A
      // plain local flag, set synchronously right here rather than read
      // from a ref that lags a render behind, is the fix.
      let firedDuplexIntro = false;
      try {
        const history = await coachService.getChatHistory();
        if (isActiveRef.current && coachService.isFirstEverCoachVisit(history)) {
          const intro = i18n.t('message:coach_voice_intro_line', {
            defaultValue:
              "Hi, I'm Saveur — your AI career coach. I'm listening whenever you're ready to talk.",
          });
          setLastCoachLine(intro);
          setPhase('speaking');
          if (duplexSupported) {
            firedDuplexIntro = true;
            speakDuplexFireAndForget(intro);
          } else {
            try {
              await speechService.speak(intro);
            } catch {
              // Both the remote voice and the on-device fallback failed --
              // same "genuinely nothing was spoken" case as sendTurn's own
              // speak() catch below, just for the very first greeting
              // instead of a reply. See that one's comment for the full
              // reasoning on why this is now surfaced instead of swallowed.
              introSpeakFailed = true;
              if (isActiveRef.current) {
                setErrorMsg(
                  i18n.t('message:voice_speak_failed', {
                    defaultValue: "Couldn't play that out loud — the text reply above is still there.",
                  }),
                );
              }
            }
          }
        }
      } catch {
        // best-effort — a failed history fetch shouldn't block listening
      }
      if (introSpeakFailed) {
        // Same reasoning as sendTurn's own pause -- startListening()
        // clears errorMsg immediately, which would otherwise wipe this
        // message before it was ever visible. Duplex path never sets
        // introSpeakFailed (speakDuplexFireAndForget doesn't throw
        // synchronously), so this pause is legacy-path-only.
        await new Promise(resolve => setTimeout(resolve, 2500));
      }
      if (duplexSupported) {
        // If the intro was just fired above, the onSpeakingState
        // listener owns the transition back to 'listening' once it
        // actually finishes -- calling startListening() here would
        // incorrectly flip the UI to "listening" while the intro is
        // still audibly playing (unlike the legacy branch just above,
        // which awaits speak() to genuinely finish first). If no intro
        // was spoken this visit, go ahead and start listening now. Uses
        // the local firedDuplexIntro flag, not phaseRef.current -- see
        // that flag's own comment for why the ref isn't safe to read
        // here yet.
        if (isActiveRef.current && !firedDuplexIntro) startListening();
        return;
      }
      if (isActiveRef.current) startListening();
    })();
    // focusGeneration is intentionally in this array (see its own comment
    // above) even though its value is never read in the body below -- its
    // only job is forcing this effect to re-evaluate on every refocus, not
    // just when `active` itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, focusGeneration]);

  // Fixes "the phone locks and the AI coach is in session, stops and the
  // voice just changes to the default phone TTS voice": iOS reclaims/
  // interrupts the audio session the moment the screen locks, mid-listen or
  // mid-speech. Left alone, the app kept blindly trying to restart
  // listening against that broken session in the background (see
  // speechService.ts's canAutoRestart guard, which now stops that), and by
  // the time the phone was unlocked, the session was in a state where the
  // next speak() call's real ElevenLabs voice (speakRemote) failed and
  // silently fell back to the on-device "default" voice. The fix: proactively
  // stop everything cleanly the moment the app leaves the foreground, and do
  // a fresh, clean restart when it returns — rather than letting the OS
  // interruption corrupt an in-flight session. The duplex engine gets the
  // exact same treatment: full teardown on background (its own AVAudioEngine
  // is just as vulnerable to an OS-forced session interruption as the old
  // pipeline was), then a clean duplexVoiceService.start() on return.
  const wasBackgroundedRef = React.useRef(false);
  // BUG FIX ATTEMPT (real-device report: coach screen "still not capturing
  // my voice at all" after the duplex wiring landed, with no error ever
  // shown). iOS fires AppState 'inactive' for plenty of reasons that AREN'T
  // a real background -- Control Center, a system alert, even a brief
  // app-switcher gesture -- not just a genuine screen lock. The legacy
  // react-native-voice pipeline below tolerates reacting to every single
  // one of those instantly (Voice.stop()/start() is cheap, and this hook
  // has its own long history of races already hardened against -- see
  // speechService.ts). DuplexVoiceEngine's teardown/restart is a much
  // heavier operation -- a full AVAudioEngine + AVAudioSession teardown and
  // rebuild, not a lightweight module stop/start -- so reacting to a
  // spurious sub-second 'inactive' blip here is a real, plausible way to
  // silently wedge the engine: torn down and rebuilt in a rapid cycle with
  // no guaranteed settle time between the two, and nothing anywhere
  // surfaces an error either way (stop() never fails; a subsequent start()
  // against a not-yet-fully-released AVAudioSession can resolve "success"
  // while genuinely capturing nothing). Debouncing the duplex-path teardown
  // by 400ms means a REAL lock (which stays backgrounded far longer than
  // that) still tears down promptly, but a spurious blip that resolves
  // back to 'active' within the window never touches the engine at all.
  const duplexBackgroundTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (!isActiveRef.current) return;
      // BUG FIX (see the `active` prop's own comment) -- this component
      // now stays mounted (and this AppState listener stays subscribed)
      // for the whole time the Coach screen is open, including while
      // sitting purely in Text mode having never touched Voice mode at
      // all this visit. Without this guard, backgrounding the app from
      // Text mode would start reacting here for the first time ever (this
      // listener could never fire in that state before, since the whole
      // component didn't exist in memory while in Text mode) -- calling
      // duplexVoiceService.stop()/start() against an engine that was
      // never started at all, touching the shared AVAudioSession for no
      // reason. Nothing to protect if Voice was never engaged.
      if (!hasEngagedRef.current) return;
      if (nextState === 'active') {
        if (duplexSupported && duplexBackgroundTimerRef.current) {
          // The debounced teardown below never actually fired -- this was
          // a spurious blip, not a real background. Nothing to restart.
          if (__DEV__) console.warn('[VoiceCoachView] AppState blip absorbed — duplex engine was never torn down');
          clearTimeout(duplexBackgroundTimerRef.current);
          duplexBackgroundTimerRef.current = null;
          wasBackgroundedRef.current = false;
          return;
        }
        if (wasBackgroundedRef.current) {
          wasBackgroundedRef.current = false;
          if (duplexSupported) {
            duplexStartedRef.current = false;
            (async () => {
              try {
                await duplexVoiceService.start();
                duplexStartedRef.current = true;
                // Only resume the visible "listening" UI/turn-taking if
                // Voice mode is ALSO the currently active mode -- the
                // engine itself is restarted either way (it's the whole
                // point of "stays warm while on the Coach screen"), but a
                // background/foreground cycle that happened while the user
                // was in Text mode shouldn't flip phase to 'listening'
                // underneath a UI that isn't even showing it.
                if (isActiveRef.current && activeRef.current) startListening();
              } catch (e: any) {
                if (isActiveRef.current) {
                  setErrorMsg(
                    e?.message ??
                      i18n.t('message:voice_mic_error', { defaultValue: 'Could not start the microphone.' }),
                  );
                  setPhase('idle');
                }
              }
            })();
          } else if (activeRef.current) {
            startListening();
          }
        }
        return;
      }
      // 'background' or 'inactive' — the screen just locked (or the app was
      // otherwise backgrounded) while a voice turn was in progress.
      wasBackgroundedRef.current = true;
      clearSilenceTimer();
      if (duplexSupported) {
        if (duplexBackgroundTimerRef.current) clearTimeout(duplexBackgroundTimerRef.current);
        duplexBackgroundTimerRef.current = setTimeout(() => {
          duplexBackgroundTimerRef.current = null;
          if (!isActiveRef.current || !wasBackgroundedRef.current) return;
          if (__DEV__) console.warn('[VoiceCoachView] real background confirmed after 400ms — tearing down duplex engine');
          duplexStartedRef.current = false;
          duplexVoiceService.stop().catch(() => {});
        }, 400);
      } else {
        stt.stop();
        speechService.stopSpeaking();
      }
      setPhase('idle');
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startListening, duplexSupported]);

  // Same breathing-pulse approach as LiveInterviewSession's Voice-mode orb
  // — a touch more pronounced while the coach is actually speaking, like
  // that screen's isAiSpeaking case.
  const pulse = useSharedValue(0);
  React.useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);
  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * (phase === 'speaking' ? 0.09 : 0.05) }],
    opacity: 0.92 + pulse.value * 0.08,
  }));
  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1.15 + pulse.value * 0.18 }],
    opacity: 0.35 - pulse.value * 0.2,
  }));

  // Product request: "the ripple animation that moves as the AI coach
  // talks... just like in other AI apps" — clarified (via direct follow-up)
  // to mean a general lively/active ripple effect while the coach is
  // speaking, NOT anything driven by the actual audio's pitch/amplitude —
  // react-native-nitro-sound's playback API exposes no amplitude/frequency
  // data at all (only duration/currentPosition), so real pitch-reactivity
  // isn't available without new native work; not needed given the
  // clarified ask. Two rings, each expanding outward and fading as it
  // grows, staggered so a new one kicks off while the previous is still
  // mid-fade — the standard "sonar ping" look most voice-assistant UIs use
  // for "I'm actively talking". Only driven (and only rendered — see the
  // JSX below) while phase === 'speaking'; reset to invisible otherwise so
  // there's nothing left over to flash when speaking starts again.
  const ripple1 = useSharedValue(0);
  const ripple2 = useSharedValue(0);
  React.useEffect(() => {
    if (phase === 'speaking') {
      ripple1.value = 0;
      ripple2.value = 0;
      ripple1.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }), -1, false);
      ripple2.value = withDelay(
        750,
        withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }), -1, false),
      );
    } else {
      ripple1.value = 0;
      ripple2.value = 0;
    }
  }, [phase, ripple1, ripple2]);
  const rippleStyle1 = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ripple1.value * 0.6 }],
    opacity: (1 - ripple1.value) * 0.55,
  }));
  const rippleStyle2 = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ripple2.value * 0.6 }],
    opacity: (1 - ripple2.value) * 0.55,
  }));

  const statusLabel =
    phase === 'listening'
      ? transcript
        ? t('message:voice_status_listening', { defaultValue: 'Listening…' })
        : t('message:voice_status_listening_prompt', { defaultValue: "I'm listening — go ahead" })
    : phase === 'thinking' ? t('message:voice_status_thinking', { defaultValue: 'Thinking…' })
    : phase === 'speaking' ? t('message:voice_status_speaking', { defaultValue: 'Speaking…' })
    : t('message:voice_status_starting', { defaultValue: 'Starting…' });

  const displayLine = phase === 'listening' && transcript ? transcript : lastCoachLine;

  return (
    <View style={styles.body}>
      <TouchableOpacity
        activeOpacity={phase === 'speaking' ? 0.8 : 1}
        onPress={onInterrupt}
        style={styles.orbWrap}>
        <Animated.View style={[styles.halo, haloStyle]}>
          {/* Product follow-up (screenshot): "change the background of this
              AI coach from blue to white" (see Chat.tsx's isVoiceMode
              comment for the full history) -- back to a blue-tinted glow in
              light mode (the ORIGINAL treatment, from before the
              screen-went-blue request that made a white glow necessary),
              since a white glow would now blend straight into the white
              page it sits on. Dark mode keeps a soft white glow -- Voice
              mode's background is a dark card surface there, so a white
              glow still reads as a halo the way it did against the old
              navy fill. */}
          <LinearGradient
            colors={isDarkMode
              ? ['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.04)']
              : ['rgba(90,150,255,0.35)', 'rgba(90,150,255,0.05)']}
            style={styles.haloFill}
          />
        </Animated.View>
        {/* Ripple rings — only rendered while the coach is actually
            speaking (see rippleStyle1/2's own comment above for why); not
            conditioned on the shared values themselves since those get
            reset to 0 (not unmounted) when phase changes, which would
            otherwise leave a static ring visible at rest. */}
        {phase === 'speaking' ? (
          <>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.rippleRing,
                rippleStyle1,
                { borderColor: isDarkMode ? 'rgba(255,255,255,0.55)' : 'rgba(90,150,255,0.55)' },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.rippleRing,
                rippleStyle2,
                { borderColor: isDarkMode ? 'rgba(255,255,255,0.55)' : 'rgba(90,150,255,0.55)' },
              ]}
            />
          </>
        ) : null}
        {/* Redesign (explicit product request — "replace the pink circle
            design... with image 4"): was a two-layer purple/pink
            LinearGradient sphere (base gradient + a glossy highlight
            overlay, both simulating a 3D sphere out of flat color); now a
            real image of one (Images.voiceOrb — see assets/images/index.ts
            for the transparency/sizing notes), so no more hand-rolled
            highlight layer needed, the image already has that baked in. */}
        <Animated.View style={[styles.orb, orbStyle]}>
          <Image source={Images.voiceOrb} style={styles.orbImage} resizeMode="contain" />
        </Animated.View>
      </TouchableOpacity>

      {/* Product follow-up: "change the background of this AI coach from
          blue to white and its text to black" -- this view is only ever
          rendered on Chat.tsx's Voice-mode Container/TopNavigation
          background (see that file's isVoiceMode comment), which now
          matches the app's normal white-card/dark-ink pair instead of a
          solid blue fill, so text colors below follow the theme
          (text-basic-color/text-hint-color) instead of a literal
          hardcoded white/translucent-white. */}
      <Text category="h7" bold center mt={24} style={{ color: theme['text-basic-color'] }}>
        {statusLabel}
      </Text>

      <Text
        category="h9-s"
        center
        mt={10}
        maxWidth={300}
        numberOfLines={4}
        ellipsizeMode="tail"
        style={{ color: theme['text-hint-color'] }}>
        {displayLine}
      </Text>

      {errorMsg ? (
        <Text category="h10" center mt={16} maxWidth={280} style={{ color: theme['color-danger-500'] }}>
          {errorMsg}
        </Text>
      ) : null}

      {phase === 'speaking' ? (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onInterrupt}
          style={[styles.interruptPill, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,99,248,0.10)' }]}>
          <Text category="h10" bold style={{ color: theme['text-basic-color'] }}>
            {t('message:voice_tap_to_interrupt', { defaultValue: 'Tap to interrupt' })}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

export default VoiceCoachView;

const styles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  orbWrap: {
    width: HALO_SIZE,
    height: HALO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  haloFill: {
    width: '100%',
    height: '100%',
  },
  // Sized to HALO_SIZE (not ORB_SIZE) for the same reason `halo` above is —
  // an absolutely-positioned child this exact size as its HALO_SIZE parent
  // sits flush at (0,0) and is already centered with no manual top/left
  // math needed.
  rippleRing: {
    position: 'absolute',
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
    borderWidth: 2,
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
  },
  // No overflow/borderRadius clipping needed anymore — Images.voiceOrb is
  // already a circular image on a transparent background (was needed for
  // the old two-layer LinearGradient version, which was a flat rectangle
  // that had to be clipped into a circle).
  orbImage: {
    width: '100%',
    height: '100%',
  },
  // backgroundColor applied inline per isDarkMode at the JSX call site (see
  // that render's own comment) -- everything else about the pill's shape
  // stays here.
  interruptPill: {
    marginTop: 28,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 99,
  },
});
