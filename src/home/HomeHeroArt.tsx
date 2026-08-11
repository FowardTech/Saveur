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

// Product request: "I love the style of illustration of the gift card...
// go through the whole app and add illustrations like it wherever
// needed" — a design-consistency sweep found several full-screen "hero
// moment" spots (Pro upgrade gates, email verification, celebrations,
// empty intro forms) using nothing but a bare 40px Eva icon glyph where
// every other major screen in the app already got one of these small
// filled-shape scenes. The six below follow the exact same construction
// ArtGiftBox/ArtDreamCompany above already established: a soft brand-tint
// wash circle behind everything, a ground shadow ellipse, then 3-5 solid
// flat shapes — no gradients, no strokes-as-outlines, no shading.

// components/ProLockGate.tsx (shared by every Pro/Pro Premium-gated
// screen in the app — Job Alerts, JD Analyzer, Career Roadmap, Salary
// Negotiation, What's Next, Learning Courses, Networking Assistant,
// Resume Builder, the whole Coach tab, and more) — was a bare
// "lock-outline" Eva icon. A padlock sitting on a small gift box reframes
// "this is a paywall" as "there's something worth unlocking here",
// matching this app's existing reward-forward tone (see the gift-box
// referral card) rather than a purely restrictive lock glyph.
export const ArtLockedGift: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    <Circle cx="60" cy="62" r="48" fill="#8B5CF60f" />
    <Ellipse cx="60" cy="98" rx="30" ry="5" fill="rgba(0,0,0,0.06)" />

    {/* small gift box, same purple/gold pairing as ArtGiftBox but scaled
        down and pushed back so the padlock reads as the foreground focus */}
    <Rect x="32" y="58" width="56" height="36" rx="4" fill="#8B5CF6" />
    <Rect x="28" y="46" width="64" height="16" rx="4" fill="#7C4DEF" />
    <Rect x="54" y="46" width="12" height="48" fill="#FFC94A" />
    <Rect x="28" y="51" width="64" height="8" fill="#FFC94A" />

    {/* padlock, pinned front-and-center on top of the box */}
    <Path
      d="M46 40a14 14 0 0 1 28 0v8"
      stroke="#F5B430"
      strokeWidth={7}
      strokeLinecap="round"
      fill="none"
    />
    <Rect x="40" y="46" width="40" height="30" rx="6" fill="#FFC94A" />
    <Circle cx="60" cy="58" r="5" fill="#7C4DEF" />
    <Rect x="57.5" y="60" width="5" height="9" rx="2.5" fill="#7C4DEF" />
  </Svg>
);

// src/auth/VerifyEmailGate.tsx — was a bare "email-outline" Eva icon above
// "Verify your email." An envelope with a checkmark badge reads as
// "confirmed"/"on its way", a more encouraging beat than a plain static
// envelope glyph for a screen whose whole point is "check your inbox, one
// more step and you're in."
export const ArtEmailSent: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    <Circle cx="60" cy="62" r="48" fill="#0063f80f" />
    <Ellipse cx="60" cy="94" rx="32" ry="5" fill="rgba(0,0,0,0.06)" />

    {/* envelope body + folded flap, drawn as two triangles over the body
        so the flap reads as a real fold, not a printed line */}
    <Rect x="26" y="42" width="68" height="46" rx="6" fill="#0063f8" />
    <Path d="M26 48 L60 72 L94 48" stroke="#EAF2FF" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />

    {/* "sent/confirmed" badge, pinned to the envelope's corner */}
    <Circle cx="90" cy="82" r="16" fill="#0EAD69" />
    <Path
      d="M83 82l5 5 10-11"
      stroke="#FFFFFF"
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
);

// src/more/CourseSession.tsx's "Tier Complete!" celebration screen — was
// a bare "award-outline" Eva icon. A real trophy with a couple of small
// sparkle accents reads as an actual celebration moment rather than a
// generic achievement badge.
export const ArtTrophy: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    <Circle cx="60" cy="62" r="48" fill="#FFC94A1a" />
    <Ellipse cx="60" cy="98" rx="26" ry="5" fill="rgba(0,0,0,0.06)" />

    {/* cup */}
    <Path d="M38 34h44v18a22 22 0 0 1-44 0z" fill="#FFC94A" />
    {/* handles */}
    <Path d="M38 38c-10 0-14 6-14 12s4 10 12 11" stroke="#F5B430" strokeWidth={5} strokeLinecap="round" fill="none" />
    <Path d="M82 38c10 0 14 6 14 12s-4 10-12 11" stroke="#F5B430" strokeWidth={5} strokeLinecap="round" fill="none" />
    {/* stem + base */}
    <Rect x="54" y="70" width="12" height="14" fill="#F5B430" />
    <Rect x="42" y="84" width="36" height="8" rx="3" fill="#F5B430" />
    <Rect x="36" y="92" width="48" height="7" rx="3.5" fill="#7C4DEF" />

    {/* sparkles */}
    <Path d="M26 30l2.4 5.6L34 38l-5.6 2.4L26 46l-2.4-5.6L18 38l5.6-2.4z" fill="#8B5CF6" />
    <Circle cx="92" cy="26" r="4" fill="#0063f8" />
  </Svg>
);

// src/more/CareerRoadmap.tsx's intro form (before a roadmap is generated)
// — had no icon at all, just description text straight into the form
// card. A winding road with a flag at the end matches the feature's own
// framing ("plans the real path to get there").
export const ArtRoadmapPath: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    <Circle cx="60" cy="62" r="48" fill="#0063f80f" />
    <Ellipse cx="60" cy="100" rx="34" ry="5" fill="rgba(0,0,0,0.06)" />

    {/* winding road, drawn as one thick curved stroke with a lighter
        centerline dash on top */}
    <Path
      d="M22 92c8-14 0-22 12-30s6-18 18-24 8-16 22-18"
      stroke="#0063f8"
      strokeWidth={12}
      strokeLinecap="round"
      fill="none"
    />
    <Path
      d="M22 92c8-14 0-22 12-30s6-18 18-24 8-16 22-18"
      stroke="#EAF2FF"
      strokeWidth={2.5}
      strokeDasharray="6 7"
      strokeLinecap="round"
      fill="none"
    />

    {/* flag, planted at the road's end */}
    <Rect x="74" y="14" width="4" height="26" rx="2" fill="#F5B430" />
    <Path d="M78 15l16 6-16 6z" fill="#FFC94A" />
  </Svg>
);

// src/more/WhatsNext.tsx's intro form (before a plan is generated) — had
// no icon at all. A signpost with a few arms pointing different
// directions matches "what's next" more literally than a single-path
// scene, and stays visually distinct from ArtRoadmapPath right above.
export const ArtSignpost: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    <Circle cx="60" cy="62" r="48" fill="#8B5CF60f" />
    <Ellipse cx="60" cy="100" rx="20" ry="5" fill="rgba(0,0,0,0.06)" />

    {/* post */}
    <Rect x="55" y="40" width="10" height="58" rx="3" fill="#7C4DEF" />

    {/* three arms at different heights/directions, each a simple
        pointed-rectangle sign */}
    <Path d="M65 44h30l-6 8H65z" fill="#8B5CF6" />
    <Path d="M55 58H30l6-8h19z" fill="#FFC94A" />
    <Path d="M65 70h24l-6 8H65z" fill="#0063f8" />
  </Svg>
);

// src/more/JDAnalyzer.tsx's intro (before a JD is analyzed) — had no icon
// on the screen at all, just the paste-text/paste-URL tabs. A magnifying
// glass over a document reads as "we're going to examine this posting."
export const ArtMagnifyingDoc: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    <Circle cx="60" cy="62" r="48" fill="#0063f80f" />
    <Ellipse cx="54" cy="100" rx="30" ry="5" fill="rgba(0,0,0,0.06)" />

    {/* document */}
    <Rect x="28" y="24" width="52" height="66" rx="5" fill="#EAF2FF" />
    <Rect x="38" y="38" width="32" height="5" rx="2.5" fill="#0063f8" />
    <Rect x="38" y="50" width="32" height="5" rx="2.5" fill="#C7DBFF" />
    <Rect x="38" y="62" width="22" height="5" rx="2.5" fill="#C7DBFF" />

    {/* magnifying glass, overlapping the document's bottom-right corner */}
    <Circle cx="76" cy="72" r="17" fill="none" stroke="#0063f8" strokeWidth={7} />
    <Line x1="88" y1="84" x2="100" y2="96" stroke="#0063f8" strokeWidth={7} strokeLinecap="round" />
  </Svg>
);
