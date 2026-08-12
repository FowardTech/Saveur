import React from 'react';
import Svg, { Defs, LinearGradient, Stop, Path, Rect, Ellipse, Circle, Line } from 'react-native-svg';

interface IconProps {
  size: number;
}

// "3D" icon badges for the Home quick-action cards (product follow-up:
// "give the 4 cards the 3D icons i talked about the last time" -- see the
// reference glossy map-pin icon the product pointed to, and the mockup
// preview built from it before this file existed). Same three-layer recipe
// as that reference: a gradient-filled body (reads as rounded/lit from one
// side instead of flat), a small translucent highlight ellipse near the top
// for the "glossy" reflection, and a soft ground shadow ellipse beneath for
// lift -- applied here to this app's own glyph shapes (chat bubble / mic /
// briefcase / book) instead of a generic pin.
//
// These REPLACE QuickActionGrid.tsx's old flat Eva-icon-in-a-solid-circle
// badge entirely (see that file's own comment) -- each icon below is its
// own complete badge with its own shape, fill, and shadow, not a glyph that
// needs a separate colored circle behind it.
//
// Each icon is purpose-built for the ONE tile it renders on, not a generic
// re-tintable component the way HomeHeroArt.tsx's illustrations are. All
// four now sit on plain white tiles (Career Coach's tile briefly went
// `solid` blue -- see HomeSrc.tsx/QuickActionGrid.tsx's own history -- and
// IconChatBubble3D was a glossy white-on-pale-blue gradient for that one
// tile specifically; it's back on the same brand-blue, light-to-dark
// gradient the other icons use now that every tile is white again), so
// every icon's body gradient is this app's own brand blue, light-to-dark.

export const IconChatBubble3D: React.FC<IconProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Defs>
      <LinearGradient id="qaChatGrad" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#58A6FF" />
        <Stop offset="100%" stopColor="#0047B3" />
      </LinearGradient>
    </Defs>
    <Ellipse cx="32" cy="52" rx="14" ry="3.5" fill="rgba(0,0,0,0.18)" />
    <Path
      d="M14 14h36a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H30l-9 8v-8h-7a6 6 0 0 1-6-6V20a6 6 0 0 1 6-6z"
      fill="url(#qaChatGrad)"
    />
    <Ellipse cx="24" cy="21" rx="9" ry="5" fill="rgba(255,255,255,0.4)" />
    <Circle cx="24" cy="27" r="3" fill="#EAF2FF" />
    <Circle cx="32" cy="27" r="3" fill="#EAF2FF" />
    <Circle cx="40" cy="27" r="3" fill="#EAF2FF" />
  </Svg>
);

export const IconMic3D: React.FC<IconProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Defs>
      <LinearGradient id="qaMicGrad" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#58A6FF" />
        <Stop offset="100%" stopColor="#0047B3" />
      </LinearGradient>
    </Defs>
    <Ellipse cx="32" cy="56" rx="15" ry="3.5" fill="rgba(0,0,0,0.10)" />
    <Rect x="24" y="8" width="16" height="28" rx="8" fill="url(#qaMicGrad)" />
    <Ellipse cx="29" cy="16" rx="4" ry="7" fill="rgba(255,255,255,0.4)" />
    <Path d="M17 28a15 15 0 0 0 30 0" stroke="#0047B3" strokeWidth={4.5} fill="none" strokeLinecap="round" />
    <Line x1="32" y1="43" x2="32" y2="50" stroke="#0047B3" strokeWidth={4.5} strokeLinecap="round" />
    <Line x1="22" y1="50" x2="42" y2="50" stroke="#0047B3" strokeWidth={4.5} strokeLinecap="round" />
  </Svg>
);

export const IconBriefcase3D: React.FC<IconProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Defs>
      <LinearGradient id="qaBriefcaseGrad" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#58A6FF" />
        <Stop offset="100%" stopColor="#0047B3" />
      </LinearGradient>
    </Defs>
    <Ellipse cx="32" cy="54" rx="16" ry="3.5" fill="rgba(0,0,0,0.10)" />
    <Rect x="14" y="20" width="36" height="26" rx="6" fill="url(#qaBriefcaseGrad)" />
    <Rect x="26" y="12" width="12" height="8" rx="2" fill="url(#qaBriefcaseGrad)" />
    <Rect x="14" y="30" width="36" height="4" fill="rgba(255,255,255,0.25)" />
    <Ellipse cx="24" cy="26" rx="6" ry="3" fill="rgba(255,255,255,0.45)" />
  </Svg>
);

export const IconBook3D: React.FC<IconProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Defs>
      <LinearGradient id="qaBookGrad" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#58A6FF" />
        <Stop offset="100%" stopColor="#0047B3" />
      </LinearGradient>
    </Defs>
    <Ellipse cx="32" cy="54" rx="17" ry="3.5" fill="rgba(0,0,0,0.10)" />
    <Path d="M31 18 L12 23 L12 46 L31 50 Z" fill="#C7DBFF" />
    <Path d="M33 18 L52 23 L52 46 L33 50 Z" fill="url(#qaBookGrad)" />
    <Rect x="29" y="16" width="6" height="34" rx="3" fill="#0047B3" />
    <Ellipse cx="41" cy="27" rx="6" ry="3" fill="rgba(255,255,255,0.4)" />
  </Svg>
);
