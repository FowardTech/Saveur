import React from 'react';
import Svg, { Circle, Ellipse, Rect, Path, Line } from 'react-native-svg';

// Small decorative illustrations for Home's hero cards (product follow-up:
// "the cards are too plain... place some svg illustration on the right side
// of the cards"). Deliberately NOT the full 300x300 onboarding-carousel
// mascot scenes (src/onboarding/illustrations.tsx) — those are sized to be
// the whole point of a full-width slide; these are a small corner accent
// that has to share space with real title/subtitle text on a compact card,
// so each is a simple, readable glyph-style scene instead of a busy one.
// Career Coach / Practice sit on a saturated gradient card, so their shapes
// are translucent white (reads as an etched/frosted accent against any
// gradient) with a soft drop shadow beneath for depth; Dream Company
// Dashboard sits on a white card, so its shapes use real brand color.
//
// REDESIGN (product follow-up: "the illustration you placed in the dream
// company card is not looking professional") — ArtDreamCompany was a
// briefcase with a floating star, which read as flat/generic (closer to a
// shopping-bag glyph than anything "company"-specific). Replaced with a
// two-building skyline (a shorter light-tinted building behind a taller
// brand-blue one, each with a real window grid and a ground line) — an
// immediately legible "company/office" scene at this size, plus a small
// gold star badge pinned to the tall building for the "dream" framing,
// rather than a plain generic icon.

interface ArtProps {
  size: number;
}

export const ArtCareerCoach: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    <Circle cx="60" cy="58" r="48" fill="rgba(255,255,255,0.14)" />
    <Ellipse cx="60" cy="96" rx="26" ry="5" fill="rgba(0,0,0,0.08)" />
    <Path d="M38 78l-6 16 20-11z" fill="rgba(255,255,255,0.96)" />
    <Rect x="26" y="32" width="68" height="48" rx="18" fill="rgba(255,255,255,0.96)" />
    <Circle cx="45" cy="56" r="5.5" fill="#0063f8" />
    <Circle cx="60" cy="56" r="5.5" fill="#0063f8" />
    <Circle cx="75" cy="56" r="5.5" fill="#0063f8" />
  </Svg>
);

export const ArtPractice: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    <Circle cx="60" cy="60" r="48" fill="rgba(255,255,255,0.14)" />
    <Ellipse cx="60" cy="98" rx="22" ry="5" fill="rgba(0,0,0,0.08)" />
    <Rect x="47" y="24" width="26" height="44" rx="13" fill="rgba(255,255,255,0.96)" />
    <Path
      d="M36 56a24 24 0 0 0 48 0"
      stroke="rgba(255,255,255,0.96)"
      strokeWidth={5.5}
      fill="none"
      strokeLinecap="round"
    />
    <Line x1="60" y1="80" x2="60" y2="90" stroke="rgba(255,255,255,0.96)" strokeWidth={5.5} strokeLinecap="round" />
    <Line x1="45" y1="90" x2="75" y2="90" stroke="rgba(255,255,255,0.96)" strokeWidth={5.5} strokeLinecap="round" />
  </Svg>
);

export const ArtDreamCompany: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    <Circle cx="60" cy="62" r="48" fill="#0063f80f" />

    {/* back building — shorter, light tint, sits behind/left of the front
        one for real depth instead of a single flat glyph */}
    <Rect x="22" y="54" width="28" height="46" rx="4" fill="#C7DBFF" />
    <Rect x="29" y="62" width="6" height="6" rx="1.2" fill="#FFFFFF" />
    <Rect x="41" y="62" width="6" height="6" rx="1.2" fill="#FFFFFF" />
    <Rect x="29" y="74" width="6" height="6" rx="1.2" fill="#FFFFFF" />
    <Rect x="41" y="74" width="6" height="6" rx="1.2" fill="#FFFFFF" />
    <Rect x="29" y="86" width="6" height="6" rx="1.2" fill="#FFFFFF" />
    <Rect x="41" y="86" width="6" height="6" rx="1.2" fill="#FFFFFF" />

    {/* front building — taller, brand blue, a real window grid + a door */}
    <Rect x="50" y="32" width="36" height="68" rx="5" fill="#0063f8" />
    <Rect x="58" y="42" width="7.5" height="7.5" rx="1.6" fill="#EAF2FF" />
    <Rect x="71" y="42" width="7.5" height="7.5" rx="1.6" fill="#EAF2FF" />
    <Rect x="58" y="56" width="7.5" height="7.5" rx="1.6" fill="#EAF2FF" />
    <Rect x="71" y="56" width="7.5" height="7.5" rx="1.6" fill="#EAF2FF" />
    <Rect x="58" y="70" width="7.5" height="7.5" rx="1.6" fill="#EAF2FF" />
    <Rect x="71" y="70" width="7.5" height="7.5" rx="1.6" fill="#EAF2FF" />
    <Rect x="64" y="86" width="8" height="14" rx="1.6" fill="#EAF2FF" opacity={0.75} />

    {/* ground line + soft shadow, grounds both buildings as one scene */}
    <Rect x="20" y="100" width="70" height="3" rx="1.5" fill="#0063f833" />
    <Ellipse cx="55" cy="106" rx="38" ry="4" fill="rgba(0,0,0,0.05)" />

    {/* "dream" badge — small gold star pinned to the tall building's roof,
        not floating disconnected from the scene */}
    <Circle cx="86" cy="28" r="11" fill="#FFC94A" />
    <Path
      d="M86 21.5l2.1 4.4 4.8 0.6-3.5 3.4 0.9 4.8-4.3-2.3-4.3 2.3 0.9-4.8-3.5-3.4 4.8-0.6z"
      fill="#FFFFFF"
    />
  </Svg>
);

// Referral program (product request: "Home card + a gift-box referral
// screen") — a real gift box (lid, ribbon cross, bow) rather than the flat
// single-glyph "gift-outline" Eva icon the referral screen used before this,
// sitting on a white card like ArtDreamCompany above (this feature has
// never been on a colored-gradient card). Purple box (constants/theme/
// appTheme.json's color-accent-purple, #8B5CF6 — this app's existing
// "special/featured" accent, see StatusBadge's `accent` variant) with a
// warm gold ribbon/bow for a genuine "gift" read rather than reusing the
// brand-blue everything else on this screen already uses.
export const ArtGiftBox: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    <Circle cx="60" cy="62" r="48" fill="#8B5CF60f" />

    {/* ground shadow, grounds the box in the scene like the other scenes'
        own shadow ellipse */}
    <Ellipse cx="60" cy="100" rx="34" ry="5" fill="rgba(0,0,0,0.06)" />

    {/* box body */}
    <Rect x="30" y="56" width="60" height="42" rx="4" fill="#8B5CF6" />
    {/* lid, slightly wider + a hair taller than the body so it reads as a
        separate piece sitting on top, not just a stripe */}
    <Rect x="25" y="42" width="70" height="18" rx="4" fill="#7C4DEF" />
    {/* vertical + horizontal ribbon, over both lid and body in one pass */}
    <Rect x="53" y="42" width="14" height="56" fill="#FFC94A" />
    <Rect x="25" y="48" width="70" height="10" fill="#FFC94A" />

    {/* bow — two teardrop loops + a small knot, pinned centered on the lid */}
    <Path d="M60 42c0-10-16-14-18-4-1.5 7 8 10 18 4z" fill="#FFC94A" />
    <Path d="M60 42c0-10 16-14 18-4 1.5 7-8 10-18 4z" fill="#FFC94A" />
    <Circle cx="60" cy="41" r="5" fill="#F5B430" />
  </Svg>
);
