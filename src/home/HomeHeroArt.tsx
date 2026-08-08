import React from 'react';
import Svg, { Circle, Rect, Path, Line } from 'react-native-svg';

// Small decorative illustrations for Home's hero cards (product follow-up:
// "the cards are too plain... place some svg illustration on the right side
// of the cards"). Deliberately NOT the full 300x300 onboarding-carousel
// mascot scenes (src/onboarding/illustrations.tsx) — those are sized to be
// the whole point of a full-width slide; these are a small corner accent
// that has to share space with real title/subtitle text on a compact card,
// so each is a simple, readable glyph-style scene instead of a busy one.
// Career Coach / Practice sit on a saturated gradient card, so their shapes
// are translucent white (reads as an etched/frosted accent against any
// gradient); Dream Company Dashboard sits on a white card, so its shapes use
// real brand color instead.

interface ArtProps {
  size: number;
}

export const ArtCareerCoach: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    <Circle cx="60" cy="58" r="48" fill="rgba(255,255,255,0.14)" />
    <Path d="M38 78l-6 16 20-11z" fill="rgba(255,255,255,0.95)" />
    <Rect x="26" y="32" width="68" height="48" rx="18" fill="rgba(255,255,255,0.95)" />
    <Circle cx="45" cy="56" r="5.5" fill="#0063f8" />
    <Circle cx="60" cy="56" r="5.5" fill="#0063f8" />
    <Circle cx="75" cy="56" r="5.5" fill="#0063f8" />
  </Svg>
);

export const ArtPractice: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    <Circle cx="60" cy="60" r="48" fill="rgba(255,255,255,0.14)" />
    <Rect x="47" y="24" width="26" height="44" rx="13" fill="rgba(255,255,255,0.95)" />
    <Path
      d="M36 56a24 24 0 0 0 48 0"
      stroke="rgba(255,255,255,0.95)"
      strokeWidth={5.5}
      fill="none"
      strokeLinecap="round"
    />
    <Line x1="60" y1="80" x2="60" y2="92" stroke="rgba(255,255,255,0.95)" strokeWidth={5.5} strokeLinecap="round" />
    <Line x1="45" y1="92" x2="75" y2="92" stroke="rgba(255,255,255,0.95)" strokeWidth={5.5} strokeLinecap="round" />
  </Svg>
);

export const ArtDreamCompany: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    <Circle cx="60" cy="62" r="48" fill="#0063f814" />
    <Rect x="34" y="24" width="24" height="16" rx="5" fill="none" stroke="#0063f8" strokeWidth={4.5} />
    <Rect x="26" y="50" width="68" height="42" rx="10" fill="#0063f8" />
    <Line x1="26" y1="66" x2="94" y2="66" stroke="#EAF2FF" strokeWidth={3} />
    <Rect x="52" y="60" width="16" height="14" rx="3" fill="#EAF2FF" />
    <Circle cx="88" cy="26" r="12" fill="#FFC94A" />
    <Path d="M83 26l3.4 3.4 7-7" stroke="#FFFFFF" strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
