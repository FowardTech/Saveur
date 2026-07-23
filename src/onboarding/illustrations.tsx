import React from 'react';
import Svg, {
  Circle,
  Ellipse,
  Rect,
  Path,
  G,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Line,
} from 'react-native-svg';
import ThemeContext from '../../ThemeContext';

// Each slide's big backdrop circle was a hardcoded bright pastel
// (#EAF4FF/#F1EEFF/etc.) meant to sit behind the mascot on a light screen —
// looked fine in light mode, but on dark mode's near-black screen
// (background-basic-color-1 #12121F) those same pastels read as a glaring
// white/light disc that clashes instead of "containing" the illustration.
// useIsDark below reads the same ThemeContext MoreSrc.tsx's dark-mode toggle
// already drives, and each Art component below picks a muted, desaturated
// navy-tinted variant of its own hue for that circle in dark mode instead —
// close in value to background-basic-color-2 (#1B1B2E) so it still reads as
// a subtle "stage" for the mascot rather than a flat cutout.
const useIsDark = () => React.useContext(ThemeContext).theme === 'dark';

// Onboarding carousel illustrations — a single recurring "Saveur bot"
// mascot character (rounded, gradient-shaded, chibi-robot) posed
// differently per slide, closer to the icons8-style "cute 3D character"
// illustration genre than the previous abstract hub/scorecard diagrams.
// Every rounded shape is shaded with a linear/radial gradient (light
// upper-left, darker lower-right) to fake a beveled, physical-object look,
// and everything that should read as "on the ground" sits on a 3-tier
// graduated shadow (stacked, decreasingly-opaque ellipses standing in for a
// blurred drop shadow — react-native-svg has no reliable cross-platform
// <feGaussianBlur>, so this is the usual workaround). Composition and
// exact proportions were checked visually by rendering the raw SVG with
// cairosvg and reviewing the PNG before porting to JSX, since there's no
// live RN preview available while editing.

interface ArtProps {
  size: number;
}

// ---- shared defs (gradients reused by the mascot in every scene) --------

const MascotDefs = () => (
  <Defs>
    <LinearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <Stop offset="0%" stopColor="#8CA3FF" />
      <Stop offset="100%" stopColor="#5A6EE8" />
    </LinearGradient>
    <LinearGradient id="headGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <Stop offset="0%" stopColor="#FFFFFF" />
      <Stop offset="100%" stopColor="#DCE4FF" />
    </LinearGradient>
    <RadialGradient id="screenGrad" cx="30%" cy="30%" r="80%">
      <Stop offset="0%" stopColor="#3A4FE0" />
      <Stop offset="100%" stopColor="#232F9E" />
    </RadialGradient>
    <LinearGradient id="armGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <Stop offset="0%" stopColor="#9BB0FF" />
      <Stop offset="100%" stopColor="#6E82F2" />
    </LinearGradient>
    <LinearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <Stop offset="0%" stopColor="#6E8CFF" />
      <Stop offset="100%" stopColor="#C58BFF" />
    </LinearGradient>
  </Defs>
);

// Faux-blurred grounding shadow (see file header comment).
const FloorShadow: React.FC<{cx: number; cy: number; rx: number; ry: number}> = ({cx, cy, rx, ry}) => (
  <G>
    <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#15224D" opacity={0.045} />
    <Ellipse cx={cx} cy={cy} rx={rx * 0.73} ry={ry * 0.71} fill="#15224D" opacity={0.06} />
    <Ellipse cx={cx} cy={cy} rx={rx * 0.45} ry={ry * 0.5} fill="#15224D" opacity={0.08} />
  </G>
);

// The recurring "Saveur bot" mascot, without arms — each slide draws its own
// pair of arms afterward since the pose (waving, pointing, celebrating)
// changes per scene. `cx` is the head/body's horizontal center.
const MascotCore: React.FC<{cx: number}> = ({cx}) => (
  <G>
    <Rect x={cx - 38} y={160} width={76} height={82} rx={34} fill="url(#bodyGrad)" />
    <Rect x={cx - 32} y={166} width={20} height={30} rx={10} fill="#FFFFFF" opacity={0.18} />

    <Rect x={cx - 52} y={78} width={104} height={88} rx={36} fill="url(#headGrad)" stroke="#C7D3FF" strokeWidth={2} />
    <Rect x={cx - 36} y={96} width={72} height={46} rx={18} fill="url(#screenGrad)" />
    <Circle cx={cx - 14} cy={119} r={6} fill="#FFFFFF" />
    <Circle cx={cx + 14} cy={119} r={6} fill="#FFFFFF" />
    <Path d={`M${cx - 12} 129q12 8 24 0`} stroke="#FFFFFF" strokeWidth={3.5} strokeLinecap="round" fill="none" />
    <Circle cx={cx - 42} cy={140} r={7} fill="#FFB4C6" opacity={0.55} />
    <Circle cx={cx + 42} cy={140} r={7} fill="#FFB4C6" opacity={0.55} />

    <Line x1={cx} y1={78} x2={cx} y2={62} stroke="#8CA3FF" strokeWidth={4} strokeLinecap="round" />
    <Circle cx={cx} cy={58} r={6} fill="#FFD166" />
  </G>
);

// Slide 1 — "Practice interviews with an AI coach, anytime"
// The mascot holds up a mic mid-answer, sound-wave lines fill a speech
// bubble above it, and a phone sits alongside for "practice anywhere."
export const ArtPracticeInterview: React.FC<ArtProps> = ({size}) => {
  const isDark = useIsDark();
  return (
  <Svg width={size} height={size} viewBox="0 0 300 300">
    <MascotDefs />
    <Defs>
      <LinearGradient id="bg1" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#F6F4FF" />
        <Stop offset="100%" stopColor="#EAF0FF" />
      </LinearGradient>
      <LinearGradient id="bg1Dark" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#242640" />
        <Stop offset="100%" stopColor="#1C1E36" />
      </LinearGradient>
      <LinearGradient id="bubbleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0%" stopColor="#FFFFFF" />
        <Stop offset="100%" stopColor="#F0F3FF" />
      </LinearGradient>
      <LinearGradient id="micGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#FFC48A" />
        <Stop offset="100%" stopColor="#F2954A" />
      </LinearGradient>
    </Defs>
    <Circle cx="150" cy="150" r="140" fill={isDark ? 'url(#bg1Dark)' : 'url(#bg1)'} />

    <FloorShadow cx={150} cy={240} rx={66} ry={14} />

    {/* speech bubble with sound waves */}
    <G>
      <Ellipse cx="225" cy="152" rx="11" ry="18" fill="#15224D" opacity={0.06} />
      <Rect x="196" y="58" width="72" height="50" rx="18" fill="url(#bubbleGrad)" stroke="#E3E9FA" strokeWidth={1.5} />
      <Path d="M212 108l-8 14 18-10z" fill="url(#bubbleGrad)" />
      <Line x1="212" y1="76" x2="212" y2="90" stroke="#9B7BFF" strokeWidth={4} strokeLinecap="round" />
      <Line x1="223" y1="70" x2="223" y2="96" stroke="#6E8CFF" strokeWidth={4} strokeLinecap="round" />
      <Line x1="234" y1="78" x2="234" y2="88" stroke="#9B7BFF" strokeWidth={4} strokeLinecap="round" />
      <Line x1="245" y1="72" x2="245" y2="94" stroke="#6E8CFF" strokeWidth={4} strokeLinecap="round" />
    </G>

    {/* "practice anywhere" phone */}
    <G>
      <Ellipse cx="66" cy="232" rx="20" ry="6" fill="#15224D" opacity={0.08} />
      <Rect x="48" y="196" width="36" height="56" rx="10" fill="#FFFFFF" stroke="#E3E9FA" strokeWidth={2} />
      <Rect x="53" y="203" width="26" height="38" rx="3" fill="#EAF2FF" />
      <Circle cx="66" cy="246" r="3" fill="#CFDFFB" />
    </G>

    <MascotCore cx={150} />
    {/* left arm resting */}
    <Rect x="82" y="176" width="26" height="50" rx="13" fill="url(#armGrad)" />
    <Circle cx="94" cy="228" r="12" fill="#8CA3FF" />
    {/* right arm raised, holding the mic */}
    <Rect x="188" y="120" width="24" height="56" rx="12" fill="url(#armGrad)" transform="rotate(35 200 148)" />
    <Circle cx="221" cy="118" r="12" fill="#8CA3FF" />
    <Rect x="213" y="90" width="16" height="24" rx="8" fill="url(#micGrad)" />
    <Line x1="221" y1="114" x2="221" y2="122" stroke="#F2954A" strokeWidth={3} strokeLinecap="round" />
    <Path d="M212 108a9 9 0 0 0 18 0" stroke="#F2954A" strokeWidth={2.5} fill="none" strokeLinecap="round" />
  </Svg>
  );
};

// Slide 2 — "Get instant feedback on confidence, clarity & skills"
// The mascot points up at a floating scorecard: progress ring + check, a
// mini bar chart, and a gold star badge.
export const ArtFeedback: React.FC<ArtProps> = ({size}) => {
  const isDark = useIsDark();
  return (
  <Svg width={size} height={size} viewBox="0 0 300 300">
    <MascotDefs />
    <Defs>
      <LinearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0%" stopColor="#FFFFFF" />
        <Stop offset="100%" stopColor="#EEF3FF" />
      </LinearGradient>
      <LinearGradient id="barLow" x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0%" stopColor="#E1EAFC" />
        <Stop offset="100%" stopColor="#B9CCF5" />
      </LinearGradient>
      <LinearGradient id="barMid" x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0%" stopColor="#B79CFF" />
        <Stop offset="100%" stopColor="#8C6BEF" />
      </LinearGradient>
      <LinearGradient id="barHigh" x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0%" stopColor="#8FA8FF" />
        <Stop offset="100%" stopColor="#5B7CF2" />
      </LinearGradient>
      <RadialGradient id="starGrad" cx="34%" cy="30%" r="75%">
        <Stop offset="0%" stopColor="#FFE29A" />
        <Stop offset="100%" stopColor="#F2A93C" />
      </RadialGradient>
    </Defs>
    <Circle cx="150" cy="150" r="140" fill={isDark ? '#1E2A42' : '#EAF4FF'} />

    {/* scorecard */}
    <G>
      <Rect x="150" y="52" width="128" height="108" rx="18" fill="#15224D" opacity={0.08} />
      <Rect x="146" y="46" width="128" height="108" rx="18" fill="url(#cardGrad)" stroke="#E3E9FA" strokeWidth={1.5} />
      <Rect x="149" y="49" width="122" height="14" rx="7" fill="#FFFFFF" opacity={0.5} />

      <Circle cx="185" cy="100" r="27" stroke="#E3E9FA" strokeWidth={7} fill="none" />
      <Path d="M185 73a27 27 0 1 1 -19 46" stroke="url(#brandGrad)" strokeWidth={7} strokeLinecap="round" fill="none" />
      <Path d="M175 100l7 7 13-14" stroke="#272755" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />

      <Rect x="228" y="112" width="7" height="18" rx="2" fill="url(#barLow)" />
      <Rect x="240" y="102" width="7" height="28" rx="2" fill="url(#barMid)" />
      <Rect x="252" y="90" width="7" height="40" rx="2" fill="url(#barHigh)" />

      <Circle cx="252" cy="66" r="13" fill="url(#starGrad)" />
      <Path d="M252 59l2.3 4.8 5.3 0.7-3.9 3.7 0.9 5.2-4.6-2.4-4.6 2.4 0.9-5.2-3.9-3.7 5.3-0.7z" fill="#FFFFFF" />
    </G>

    <FloorShadow cx={128} cy={240} rx={66} ry={14} />

    <MascotCore cx={128} />
    {/* left arm resting */}
    <Rect x="60" y="176" width="26" height="50" rx="13" fill="url(#armGrad)" />
    <Circle cx="72" cy="228" r="12" fill="#8CA3FF" />
    {/* right arm pointing up at the card */}
    <Rect x="150" y="128" width="24" height="58" rx="12" fill="url(#armGrad)" transform="rotate(-40 162 157)" />
    <Circle cx="188" cy="128" r="11" fill="#8CA3FF" />
  </Svg>
  );
};

// Slide 3 — "Be the first to apply see jobs"
// The mascot points excitedly at a floating job-alert card (bell + "NEW"
// ribbon) with a small gold "1st" medal beside it and motion lines behind
// the pointing arm — read together as "the alert lands, you're first."
export const ArtFirstToApply: React.FC<ArtProps> = ({size}) => {
  const isDark = useIsDark();
  return (
  <Svg width={size} height={size} viewBox="0 0 300 300">
    <MascotDefs />
    <Defs>
      <LinearGradient id="cardGrad3" x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0%" stopColor="#FFFFFF" />
        <Stop offset="100%" stopColor="#F3F0FF" />
      </LinearGradient>
      <RadialGradient id="bellGrad" cx="30%" cy="30%" r="80%">
        <Stop offset="0%" stopColor="#FFE29A" />
        <Stop offset="100%" stopColor="#F2A93C" />
      </RadialGradient>
      <RadialGradient id="medalGrad" cx="34%" cy="30%" r="75%">
        <Stop offset="0%" stopColor="#FFE29A" />
        <Stop offset="100%" stopColor="#F2A93C" />
      </RadialGradient>
      <LinearGradient id="ribbonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#FF9AA8" />
        <Stop offset="100%" stopColor="#F2607A" />
      </LinearGradient>
    </Defs>
    <Circle cx="150" cy="150" r="140" fill={isDark ? '#241F3D' : '#F1EEFF'} />

    <FloorShadow cx={128} cy={245} rx={78} ry={14} />

    {/* job-alert card */}
    <G>
      <Rect x="150" y="56" width="124" height="96" rx="18" fill="#15224D" opacity={0.07} />
      <Rect x="146" y="50" width="124" height="96" rx="18" fill="url(#cardGrad3)" stroke="#E3E9FA" strokeWidth={1.5} />

      {/* "NEW" ribbon */}
      <Rect x="222" y="42" width="52" height="22" rx="11" fill="url(#ribbonGrad)" />
      <Path d="M228 78l4-4 3 3 3-3 4 4" stroke="#FFFFFF" strokeWidth={0} fill="none" />

      {/* bell icon */}
      <Circle cx="174" cy="86" r="18" fill="url(#bellGrad)" />
      <Path
        d="M174 76c-6 0-9 5-9 11 0 7-3 9-3 9h24s-3-2-3-9c0-6-3-11-9-11z"
        fill="#FFFFFF"
      />
      <Path d="M170 98a4 4 0 0 0 8 0" fill="#FFFFFF" />

      {/* job title / company placeholder lines */}
      <Rect x="200" y="78" width="58" height="9" rx="4.5" fill="#E7E1FF" />
      <Rect x="200" y="94" width="42" height="7" rx="3.5" fill="#F1EBFF" />
      <Rect x="160" y="118" width="98" height="7" rx="3.5" fill="#F1EBFF" />
      <Rect x="160" y="131" width="70" height="7" rx="3.5" fill="#F1EBFF" />
    </G>

    {/* "1st" medal */}
    <G>
      <Ellipse cx="238" cy="182" rx="16" ry="4" fill="#15224D" opacity={0.06} />
      <Circle cx="238" cy="168" r="17" fill="url(#medalGrad)" />
      <Path d="M232 158h5v20h-5z" fill="#FFFFFF" opacity={0} />
      <G>
        {/* simple "1" glyph */}
        <Path d="M235 160h3v16h-3z" fill="#FFFFFF" />
        <Path d="M232 163l4-3v3z" fill="#FFFFFF" />
      </G>
    </G>

    {/* motion lines behind the pointing arm */}
    <Line x1="128" y1="130" x2="150" y2="118" stroke="#B7A6FF" strokeWidth={3} strokeLinecap="round" opacity={0.5} />
    <Line x1="120" y1="146" x2="146" y2="140" stroke="#B7A6FF" strokeWidth={3} strokeLinecap="round" opacity={0.4} />

    <MascotCore cx={108} />
    {/* left arm resting */}
    <Rect x="40" y="176" width="26" height="50" rx="13" fill="url(#armGrad)" />
    <Circle cx="52" cy="228" r="12" fill="#8CA3FF" />
    {/* right arm pointing up at the card */}
    <Rect x="130" y="128" width="24" height="58" rx="12" fill="url(#armGrad)" transform="rotate(-40 142 157)" />
    <Circle cx="168" cy="128" r="11" fill="#8CA3FF" />
  </Svg>
  );
};

// Slide 4 — "Get past the resume scanners"
// The mascot holds up a resume with a scan beam sweeping across it and an
// ATS-match ring (checkmark, like the scorecard ring in slide 2) confirming
// it reads clean.
export const ArtATS: React.FC<ArtProps> = ({size}) => {
  const isDark = useIsDark();
  return (
  <Svg width={size} height={size} viewBox="0 0 300 300">
    <MascotDefs />
    <Defs>
      <LinearGradient id="resumeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0%" stopColor="#FFFFFF" />
        <Stop offset="100%" stopColor="#EEF3FF" />
      </LinearGradient>
      <LinearGradient id="scanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <Stop offset="0%" stopColor="#8FE3C4" stopOpacity={0} />
        <Stop offset="50%" stopColor="#4FD9A6" stopOpacity={0.65} />
        <Stop offset="100%" stopColor="#8FE3C4" stopOpacity={0} />
      </LinearGradient>
      <RadialGradient id="checkGrad" cx="30%" cy="30%" r="80%">
        <Stop offset="0%" stopColor="#6FE0B6" />
        <Stop offset="100%" stopColor="#2FBE8B" />
      </RadialGradient>
    </Defs>
    <Circle cx="150" cy="150" r="140" fill={isDark ? '#1B2A28' : '#EAF7F1'} />

    <FloorShadow cx={158} cy={246} rx={72} ry={14} />

    {/* resume sheet */}
    <G>
      <Rect x="118" y="46" width="98" height="130" rx="14" fill="#15224D" opacity={0.07} />
      <Rect x="114" y="40" width="98" height="130" rx="14" fill="url(#resumeGrad)" stroke="#E3E9FA" strokeWidth={1.5} />
      <Circle cx="140" cy="66" r="10" fill="#DCE4FF" />
      <Rect x="156" y="60" width="42" height="7" rx="3.5" fill="#DCE4FF" />
      <Rect x="156" y="72" width="30" height="6" rx="3" fill="#EEF1FB" />
      <Rect x="126" y="92" width="72" height="6" rx="3" fill="#F1F3FB" />
      <Rect x="126" y="104" width="72" height="6" rx="3" fill="#F1F3FB" />
      <Rect x="126" y="116" width="52" height="6" rx="3" fill="#F1F3FB" />
      <Rect x="126" y="136" width="72" height="6" rx="3" fill="#F1F3FB" />
      <Rect x="126" y="148" width="60" height="6" rx="3" fill="#F1F3FB" />

      {/* scan beam sweeping across the sheet */}
      <Rect x="114" y="100" width="98" height="26" fill="url(#scanGrad)" />
      <Rect x="114" y="98" width="98" height="2" fill="#4FD9A6" opacity={0.8} />
    </G>

    {/* ATS-match badge — bottom-left, clear of both the resume sheet and the
        mascot (an earlier version sat at 216,176, which put it directly
        behind the mascot's head/body and made it invisible — verified via
        cairosvg render before landing on this position). */}
    <G>
      <Ellipse cx="100" cy="222" rx="20" ry="4" fill="#15224D" opacity={0.06} />
      <Circle cx="100" cy="200" r="24" fill="#FFFFFF" stroke="#E3E9FA" strokeWidth={1.5} />
      <Circle cx="100" cy="200" r="17" stroke="#E3E9FA" strokeWidth={6} fill="none" />
      <Path d="M100 183a17 17 0 1 1 -12 29" stroke="url(#checkGrad)" strokeWidth={6} strokeLinecap="round" fill="none" />
      <Path d="M91 200l6 6 11-12" stroke="#1C8F65" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </G>

    <MascotCore cx={200} />
    {/* right arm resting */}
    <Rect x="232" y="176" width="26" height="50" rx="13" fill="url(#armGrad)" />
    <Circle cx="244" cy="228" r="12" fill="#8CA3FF" />
    {/* left arm raised, presenting the resume */}
    <Rect x="150" y="126" width="24" height="58" rx="12" fill="url(#armGrad)" transform="rotate(35 162 155)" />
    <Circle cx="132" cy="128" r="11" fill="#8CA3FF" />
  </Svg>
  );
};

// Slide 5 — "Learn what you need, one course at a time"
// The mascot points at a floating course card — play button, progress bar,
// and a graduation cap badge marking it as a learning module.
export const ArtLearningCourses: React.FC<ArtProps> = ({size}) => {
  const isDark = useIsDark();
  return (
  <Svg width={size} height={size} viewBox="0 0 300 300">
    <MascotDefs />
    <Defs>
      <LinearGradient id="courseCardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0%" stopColor="#FFFFFF" />
        <Stop offset="100%" stopColor="#FFF6E9" />
      </LinearGradient>
      <RadialGradient id="playGrad" cx="32%" cy="30%" r="80%">
        <Stop offset="0%" stopColor="#FFC48A" />
        <Stop offset="100%" stopColor="#F2954A" />
      </RadialGradient>
      <LinearGradient id="capGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#5A6EE8" />
        <Stop offset="100%" stopColor="#3A4FE0" />
      </LinearGradient>
    </Defs>
    <Circle cx="150" cy="150" r="140" fill={isDark ? '#2A2318' : '#FFF3E6'} />

    <FloorShadow cx={128} cy={245} rx={78} ry={14} />

    {/* course card */}
    <G>
      <Rect x="150" y="60" width="126" height="92" rx="16" fill="#15224D" opacity={0.06} />
      <Rect x="146" y="54" width="126" height="92" rx="16" fill="url(#courseCardGrad)" stroke="#F3E4CE" strokeWidth={1.5} />

      {/* video thumbnail with play button */}
      <Rect x="158" y="66" width="60" height="42" rx="8" fill="#FFE7CE" />
      <Circle cx="188" cy="87" r="13" fill="url(#playGrad)" />
      <Path d="M184 81l10 6-10 6z" fill="#FFFFFF" />

      {/* title + progress bar */}
      <Rect x="226" y="70" width="38" height="7" rx="3.5" fill="#FBE3C6" />
      <Rect x="226" y="83" width="30" height="6" rx="3" fill="#FDEEDD" />
      <Rect x="158" y="122" width="102" height="8" rx="4" fill="#FBE3C6" />
      <Rect x="158" y="122" width="66" height="8" rx="4" fill="url(#playGrad)" />
    </G>

    {/* graduation cap badge */}
    <G>
      <Circle cx="252" cy="168" r="22" fill="#FFFFFF" stroke="#E3E9FA" strokeWidth={1.5} />
      <Path d="M252 158l20 8-20 8-20-8z" fill="url(#capGrad)" />
      <Path d="M240 168v9c0 3 5 6 12 6s12-3 12-6v-9" stroke="#3A4FE0" strokeWidth={2} fill="none" strokeLinecap="round" />
      <Line x1="272" y1="166" x2="272" y2="180" stroke="#3A4FE0" strokeWidth={2} strokeLinecap="round" />
      <Circle cx="272" cy="182" r="2.4" fill="#3A4FE0" />
    </G>

    <MascotCore cx={108} />
    {/* left arm resting */}
    <Rect x="40" y="176" width="26" height="50" rx="13" fill="url(#armGrad)" />
    <Circle cx="52" cy="228" r="12" fill="#8CA3FF" />
    {/* right arm pointing up at the card */}
    <Rect x="130" y="128" width="24" height="58" rx="12" fill="url(#armGrad)" transform="rotate(-40 142 157)" />
    <Circle cx="168" cy="128" r="11" fill="#8CA3FF" />
  </Svg>
  );
};

export const ONBOARDING_ART = [
  ArtPracticeInterview,
  ArtFeedback,
  ArtFirstToApply,
  ArtATS,
  ArtLearningCourses,
];
