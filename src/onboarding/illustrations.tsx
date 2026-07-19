import React from 'react';
import Svg, {
  Circle,
  Rect,
  Path,
  G,
  Defs,
  LinearGradient,
  Stop,
  Line,
} from 'react-native-svg';

// Hand-built flat illustrations for the onboarding carousel — replaces the
// leftover caregiver-template artwork (family/childcare imagery) with
// career/interview-appropriate visuals in the same soft, flat-vector style,
// using the app's own blue -> purple gradient (matching the live-interview
// orb screen) for a consistent brand feel.

interface ArtProps {
  size: number;
}

const GradientDefs = () => (
  <Defs>
    <LinearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <Stop offset="0%" stopColor="#6E8CFF" />
      <Stop offset="100%" stopColor="#C58BFF" />
    </LinearGradient>
  </Defs>
);

// Slide 1 — "Practice interviews with an AI coach, anytime"
// A person at a laptop talking with a friendly gradient "AI orb" avatar.
export const ArtPracticeInterview: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 300 300">
    <GradientDefs />
    <Circle cx="150" cy="150" r="140" fill="#FFF1E9" />

    {/* desk */}
    <Rect x="40" y="215" width="220" height="10" rx="5" fill="#E8DCCE" />

    {/* laptop */}
    <Rect x="70" y="150" width="120" height="70" rx="10" fill="#272755" />
    <Rect x="80" y="160" width="100" height="50" rx="4" fill="#EAF0FF" />
    <Rect x="60" y="218" width="140" height="10" rx="5" fill="#3B3B72" />

    {/* AI orb on laptop screen */}
    <Circle cx="130" cy="185" r="22" fill="url(#brandGrad)" />
    <Circle cx="122" cy="177" r="7" fill="#FFFFFF" opacity="0.55" />

    {/* sound wave from orb */}
    <Line x1="160" y1="178" x2="160" y2="192" stroke="#9B7BFF" strokeWidth="3" strokeLinecap="round" />
    <Line x1="167" y1="172" x2="167" y2="198" stroke="#9B7BFF" strokeWidth="3" strokeLinecap="round" />
    <Line x1="174" y1="180" x2="174" y2="190" stroke="#9B7BFF" strokeWidth="3" strokeLinecap="round" />

    {/* person */}
    <G>
      <Circle cx="215" cy="140" r="24" fill="#FFD3B0" />
      <Path
        d="M180 225c0-30 20-48 35-48s35 18 35 48"
        fill="#FF8A65"
      />
      <Rect x="205" y="118" width="20" height="10" rx="5" fill="#272755" />
    </G>

    {/* chair */}
    <Rect x="192" y="200" width="46" height="8" rx="4" fill="#D8CFC0" />
  </Svg>
);

// Slide 2 — "Get instant feedback on confidence, clarity & skills"
// A scorecard: circular progress ring with a checkmark, a star, and a small
// upward trend chart.
export const ArtFeedback: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 300 300">
    <GradientDefs />
    <Circle cx="150" cy="150" r="140" fill="#EAF4FF" />

    {/* card */}
    <Rect x="55" y="70" width="190" height="160" rx="20" fill="#FFFFFF" />
    <Rect x="55" y="70" width="190" height="160" rx="20" fill="#FFFFFF" stroke="#E3E9FA" strokeWidth="2" />

    {/* progress ring */}
    <Circle cx="120" cy="150" r="42" stroke="#E3E9FA" strokeWidth="10" fill="none" />
    <Path
      d="M120 108a42 42 0 1 1 -29.7 71.7"
      stroke="url(#brandGrad)"
      strokeWidth="10"
      strokeLinecap="round"
      fill="none"
    />
    <Path
      d="M106 150l10 10 20-22"
      stroke="#272755"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />

    {/* mini bar chart */}
    <Rect x="180" y="165" width="10" height="25" rx="3" fill="#CFDFFB" />
    <Rect x="196" y="150" width="10" height="40" rx="3" fill="#9B7BFF" />
    <Rect x="212" y="130" width="10" height="60" rx="3" fill="#6E8CFF" />

    {/* star badge */}
    <Circle cx="215" cy="95" r="18" fill="#FFD166" />
    <Path
      d="M215 86l3.2 6.6 7.3 1-5.3 5.1 1.3 7.2-6.5-3.4-6.5 3.4 1.3-7.2-5.3-5.1 7.3-1z"
      fill="#FFFFFF"
    />
  </Svg>
);

// Slide 3 — "Track every application from Applied to Offer"
// A three-column pipeline board with a card mid-flight toward an Offer flag.
export const ArtTracker: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 300 300">
    <GradientDefs />
    <Circle cx="150" cy="150" r="140" fill="#F1EEFF" />

    {/* columns */}
    <Rect x="45" y="95" width="60" height="140" rx="12" fill="#FFFFFF" stroke="#E3E9FA" strokeWidth="2" />
    <Rect x="120" y="95" width="60" height="140" rx="12" fill="#FFFFFF" stroke="#E3E9FA" strokeWidth="2" />
    <Rect x="195" y="95" width="60" height="140" rx="12" fill="#FFFFFF" stroke="#E3E9FA" strokeWidth="2" />

    {/* column header dots */}
    <Circle cx="75" cy="112" r="5" fill="#CFDFFB" />
    <Circle cx="150" cy="112" r="5" fill="#9B7BFF" />
    <Circle cx="225" cy="112" r="5" fill="#FFD166" />

    {/* cards in first column */}
    <Rect x="53" y="128" width="44" height="26" rx="6" fill="#EAF0FF" />
    <Rect x="53" y="160" width="44" height="26" rx="6" fill="#EAF0FF" />

    {/* card in second column */}
    <Rect x="128" y="128" width="44" height="26" rx="6" fill="#F1EBFF" />

    {/* card flying to third column */}
    <G>
      <Rect x="165" y="185" width="40" height="24" rx="6" fill="url(#brandGrad)" opacity="0.9" />
      <Path
        d="M172 213c15-10 30-15 45-12"
        stroke="#9B7BFF"
        strokeWidth="2.5"
        strokeDasharray="4 5"
        fill="none"
      />
    </G>

    {/* offer flag in third column */}
    <Path d="M225 128v40" stroke="#272755" strokeWidth="4" strokeLinecap="round" />
    <Path d="M225 128l24 9-24 9z" fill="#FFD166" />
  </Svg>
);

export const ONBOARDING_ART = [ArtPracticeInterview, ArtFeedback, ArtTracker];
