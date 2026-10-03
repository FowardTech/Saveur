import React from 'react';
import Svg, { Circle, Ellipse, Rect, Path, Line, Polygon } from 'react-native-svg';

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
//
// RETINTED (product follow-up: "place some beautiful illustrations as
// background image of the 3 [quick-action] cards") — ArtCareerCoach/
// ArtPractice were originally translucent-white-on-brand-color, built for
// the OLD saturated-gradient hero cards (see git history). Those same
// shapes would be invisible sitting behind the current Material 3 tonal
// tiles (QuickActionGrid.tsx), which are a pale, near-white fill, not a
// saturated color — so both are re-colored here to the same "solid brand-
// tint shapes over a faint brand-tint backdrop circle" construction
// ArtDreamCompany/ArtGiftBox below already use.
//
// RETINTED AGAIN, back to blue (product follow-up: "All the three cards
// should have the default blue background") — the three quick-action
// tiles briefly had distinct per-card hues (blue/emerald/amber); once
// product asked for all three tiles to share one blue background instead,
// ArtPractice/ArtDreamCompany's emerald/amber palettes would have clashed
// with their own now-blue tile, so both are back to this app's one brand
// blue (#71717a) here too, matching ArtCareerCoach.
//
// ArtCareerCoach RETINTED A THIRD TIME, back to its ORIGINAL translucent-
// white-on-saturated-blue palette (product follow-up: "give the career
// coach card the default blue background and the text in it white",
// followed by "you forgot the illustration in the career coach card...
// its not visible") — QuickActionGrid.tsx's `solid` tile treatment made
// this one card's own fill a full-strength blue again (see that file's
// own comment), so the solid-`tint`-shapes-on-pale-backdrop construction
// every OTHER illustration here uses would be invisible again on THIS
// one card specifically, the exact problem the pale-background retint
// above was originally solving in reverse. Back to the same translucent-
// white shapes + brand-blue dots this app's very first gradient-era hero
// cards used (see this file's own top comment) -- ArtPractice/
// ArtDreamCompany/ArtLearningCourses are untouched, since their own tiles
// are still the pale tonal look.
//
// ArtCareerCoach RETINTED A FOURTH TIME, back to solid-tint-shapes-on-
// pale-backdrop (product follow-up: "turning the 4 [quick-action] cards
// to white background" — the `solid` full-strength-blue tile treatment
// that needed this illustration's own translucent-white palette is gone;
// see QuickActionGrid.tsx's own comment). All four quick-action tiles are
// plain white cards now, so ArtCareerCoach converges back onto the exact
// same construction ArtPractice/ArtDreamCompany/ArtLearningCourses below
// already use — one consistent illustration style across all four.
//
// ArtCareerCoach RETINTED A FIFTH TIME, back to translucent-white-on-
// saturated-blue (immediate product follow-up: "give the career [coach]
// card the default blue background") — `solid` is back on just this one
// tile (see QuickActionGrid.tsx's own comment), so its fill is a full-
// strength blue again and the solid-tint-on-pale-backdrop construction
// above would go invisible against it, same problem/same fix as the
// third retint above. ArtPractice/ArtDreamCompany/ArtLearningCourses stay
// on the pale-tonal construction -- their own tiles are still plain white.
//
// ArtCareerCoach RETINTED A SIXTH TIME, back to solid-tint-shapes-on-
// pale-backdrop (product follow-up: "make the career coach card white
// background too like the other 3 cards") — `solid` is off this tile for
// good this time (see QuickActionGrid.tsx's own comment), so it converges
// back onto the exact same construction ArtPractice/ArtDreamCompany below
// use, matching every other white quick-action tile.
//
// ArtCareerCoach RETINTED A SEVENTH TIME, to ArtGiftBox's purple/gold
// palette (product follow-up: "remove the practice card and make the
// career coach card full width and give it a black and purple linear
// gradient color... give the career card the same style of illustration
// you gave to the referral card") — Career Coach is no longer a
// QuickActionGrid tile at all (see HomeSrc.tsx's own history), it's its
// own standalone black-to-purple gradient hero card, same shape as the
// Refer & Earn card whose illustration (ArtGiftBox below) is this
// construction's actual reference point: solid brand-purple/gold flat
// shapes, not the brand-blue-on-pale-backdrop every remaining white tile
// uses (that combination would have low contrast against a dark gradient
// fill anyway).

interface ArtProps {
  size: number;
  // ArtPractice only (product follow-up: "why did you leave... the mic
  // icon in the career focus card?" / "the icon background... is glossy
  // gradient") -- HomeSrc.tsx now wraps this illustration in a
  // GradientIconBadge (components/GradientIconBadge.tsx) instead of
  // sitting bare on the page, so its own soft brand-tint backdrop circle
  // would double up against (and clash color-wise with) that new colored
  // badge behind it. `light` swaps the mic to a white stroke (matching
  // every other glyph on a colored badge app-wide) and drops the redundant
  // backdrop circle, letting the badge itself be the only background.
  light?: boolean;
}

export const ArtCareerCoach: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    <Circle cx="60" cy="58" r="48" fill="#71717a0f" />
    <Ellipse cx="60" cy="96" rx="26" ry="5" fill="rgba(0,0,0,0.06)" />
    <Path d="M38 78l-6 16 20-11z" fill="#7C4DEF" />
    <Rect x="26" y="32" width="68" height="48" rx="18" fill="#71717a" />
    <Circle cx="45" cy="56" r="5.5" fill="#FFC94A" />
    <Circle cx="60" cy="56" r="5.5" fill="#FFC94A" />
    <Circle cx="75" cy="56" r="5.5" fill="#FFC94A" />
  </Svg>
);

// Product follow-up: "I want the today's career focus mic icon to be a
// line illustration icon not a filled one" -- the mic body (the Rect
// below) was the one solid-fill shape in this illustration; every other
// piece (pickup arc + stand) was already stroke-only. Switched the Rect
// to fill="none" + the same stroke treatment as the rest so the whole mic
// reads as one consistent outline drawing, not a filled glyph with
// stroked accents around it.
export const ArtPractice: React.FC<ArtProps> = ({ size, light }) => {
  const strokeColor = light ? '#FFFFFF' : '#71717a';
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      {!light && <Circle cx="60" cy="60" r="48" fill="#71717a0f" />}
      <Ellipse cx="60" cy="98" rx="22" ry="5" fill="rgba(0,0,0,0.06)" />
      <Rect
        x="47"
        y="24"
        width="26"
        height="44"
        rx="13"
        fill="none"
        stroke={strokeColor}
        strokeWidth={5.5}
      />
      <Path
        d="M36 56a24 24 0 0 0 48 0"
        stroke={strokeColor}
        strokeWidth={5.5}
        fill="none"
        strokeLinecap="round"
      />
      <Line x1="60" y1="80" x2="60" y2="90" stroke={strokeColor} strokeWidth={5.5} strokeLinecap="round" />
      <Line x1="45" y1="90" x2="75" y2="90" stroke={strokeColor} strokeWidth={5.5} strokeLinecap="round" />
    </Svg>
  );
};

export const ArtDreamCompany: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    <Circle cx="60" cy="62" r="48" fill="#71717a0f" />

    {/* back building — shorter, light tint, sits behind/left of the front
        one for real depth instead of a single flat glyph */}
    <Rect x="22" y="54" width="28" height="46" rx="4" fill="#C7DBFF" />
    <Rect x="29" y="62" width="6" height="6" rx="1.2" fill="#FFFFFF" />
    <Rect x="41" y="62" width="6" height="6" rx="1.2" fill="#FFFFFF" />
    <Rect x="29" y="74" width="6" height="6" rx="1.2" fill="#FFFFFF" />
    <Rect x="41" y="74" width="6" height="6" rx="1.2" fill="#FFFFFF" />
    <Rect x="29" y="86" width="6" height="6" rx="1.2" fill="#FFFFFF" />
    <Rect x="41" y="86" width="6" height="6" rx="1.2" fill="#FFFFFF" />

    {/* front building — taller, this app's brand blue, a real window grid
        + a door */}
    <Rect x="50" y="32" width="36" height="68" rx="5" fill="#71717a" />
    <Rect x="58" y="42" width="7.5" height="7.5" rx="1.6" fill="#EAF2FF" />
    <Rect x="71" y="42" width="7.5" height="7.5" rx="1.6" fill="#EAF2FF" />
    <Rect x="58" y="56" width="7.5" height="7.5" rx="1.6" fill="#EAF2FF" />
    <Rect x="71" y="56" width="7.5" height="7.5" rx="1.6" fill="#EAF2FF" />
    <Rect x="58" y="70" width="7.5" height="7.5" rx="1.6" fill="#EAF2FF" />
    <Rect x="71" y="70" width="7.5" height="7.5" rx="1.6" fill="#EAF2FF" />
    <Rect x="64" y="86" width="8" height="14" rx="1.6" fill="#EAF2FF" opacity={0.75} />

    {/* ground line + soft shadow, grounds both buildings as one scene */}
    <Rect x="20" y="100" width="70" height="3" rx="1.5" fill="#71717a33" />
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

// src/home/HomeSrc.tsx's "Learning Courses" quick-action tile (product
// follow-up: "you did not give the learning course card its own
// illustration") — an open book reads as the clearest "courses/learning"
// glyph at this size, same construction as ArtDreamCompany above (a
// lighter-tint page behind a full-brand-blue one for real depth, not a
// single flat shape) plus a small bookmark ribbon pinned to the spine for
// a "there's real progress being tracked here" beat, matching this app's
// own reward-forward tone (see ArtGiftBox/ArtDreamCompany's own pinned
// badges) rather than a static, generic book icon.
export const ArtLearningCourses: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    <Circle cx="60" cy="62" r="48" fill="#71717a0f" />
    <Ellipse cx="60" cy="100" rx="34" ry="5" fill="rgba(0,0,0,0.06)" />

    {/* left page — lighter tint, sits behind the spine for real depth */}
    <Path d="M58 38 L20 46 L20 90 L58 96 Z" fill="#C7DBFF" />
    <Rect x="27" y="58" width="24" height="4" rx="2" fill="#FFFFFF" />
    <Rect x="27" y="68" width="24" height="4" rx="2" fill="#FFFFFF" />
    <Rect x="27" y="78" width="18" height="4" rx="2" fill="#FFFFFF" />

    {/* right page — full brand blue, the "open" side facing forward */}
    <Path d="M62 38 L100 46 L100 90 L62 96 Z" fill="#71717a" />
    <Rect x="69" y="58" width="24" height="4" rx="2" fill="#EAF2FF" />
    <Rect x="69" y="68" width="24" height="4" rx="2" fill="#EAF2FF" />
    <Rect x="69" y="78" width="18" height="4" rx="2" fill="#EAF2FF" />

    {/* spine, binds both pages into one scene */}
    <Rect x="58" y="36" width="4" height="62" rx="2" fill="#0047B3" />

    {/* bookmark ribbon, pinned at the spine's top */}
    <Path d="M56 20h8v22l-4-3-4 3z" fill="#FFC94A" />
  </Svg>
);

// Referral program (product request: "Home card + a gift-box referral
// screen") — a real gift box (lid, ribbon cross, bow) rather than the flat
// single-glyph "gift-outline" Eva icon the referral screen used before this,
// sitting on a white card like ArtDreamCompany above (this feature has
// never been on a colored-gradient card). Purple box (constants/theme/
// appTheme.json's color-accent-purple, #71717a — this app's existing
// "special/featured" accent, see StatusBadge's `accent` variant) with a
// warm gold ribbon/bow for a genuine "gift" read rather than reusing the
// brand-blue everything else on this screen already uses.
// REVERTED from unDraw back to a hand-drawn scene (product report: "The
// recent illustrations you added are too small make them moderate. Also i
// dont want illustrations from undraw. I would prefer humaan[s], icons8
// and iconscout"). Checked live licensing on all three named sources first:
// Humaaans itself (https://www.humaaans.com) is genuinely CC0/no-
// attribution, but it's a mix-and-match library of body parts distributed
// as a Sketch/Figma design file, not ready-made themed scene SVGs like
// unDraw's -- there's no "gift box" scene to just download. Icons8 and
// IconScout's free tiers both require a live attribution link back to
// them unless a paid plan is purchased, which this app doesn't have. Given
// the tradeoffs, the user chose "Humaaans figures + my own simple props":
// an original, hand-drawn flat-shape person (same circle-head + body-path
// construction ArtWelcomeWave/ArtWorkplaceCompass below already use --
// Humaaans' own visual language: simple, rounded, friendly figures) paired
// with a simple prop, drawn by hand rather than reproducing anyone else's
// licensed artwork. Bigger than the original box-only version (viewBox
// grown from 120x120 to 140x140, box scaled up) per "make them moderate".
export const ArtGiftBox: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 140 140">
    <Circle cx="70" cy="70" r="56" fill="#71717a0f" />
    <Ellipse cx="70" cy="118" rx="42" ry="6" fill="rgba(0,0,0,0.06)" />

    {/* small figure, presenting the box with an outstretched arm --
        Humaaans-style flat person: circle head + single body path */}
    <Circle cx="34" cy="70" r="10" fill="#71717a" />
    <Path d="M18 114c0-13 7-22 16-22s16 9 16 22z" fill="#71717a" />
    <Path d="M44 88c6 2 10 8 12 14" stroke="#71717a" strokeWidth={6} strokeLinecap="round" fill="none" />

    {/* box body */}
    <Rect x="52" y="64" width="70" height="49" rx="5" fill="#71717a" />
    {/* lid */}
    <Rect x="46" y="48" width="82" height="21" rx="5" fill="#7C4DEF" />
    {/* ribbon */}
    <Rect x="80" y="48" width="16" height="65" fill="#FFC94A" />
    <Rect x="46" y="55" width="82" height="11" fill="#FFC94A" />

    {/* bow */}
    <Path d="M88 48c0-11-18-16-21-4-1.7 8 9 11 21 4z" fill="#FFC94A" />
    <Path d="M88 48c0-11 18-16 21-4 1.7 8-9 11-21 4z" fill="#FFC94A" />
    <Circle cx="88" cy="47" r="5.5" fill="#F5B430" />
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
// REVERTED from unDraw back to a hand-drawn scene, sized up -- see
// ArtGiftBox's own comment above for the full licensing writeup behind
// this change (same reasoning applies to every illustration in this file
// that used to route through illustrationSvgs.ts).
export const ArtLockedGift: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 140 140">
    <Circle cx="70" cy="70" r="56" fill="#71717a0f" />
    <Ellipse cx="70" cy="114" rx="34" ry="6" fill="rgba(0,0,0,0.06)" />

    {/* small gift box, same purple/gold pairing as ArtGiftBox but scaled
        down and pushed back so the padlock reads as the foreground focus */}
    <Rect x="37" y="66" width="65" height="42" rx="5" fill="#71717a" />
    <Rect x="32" y="52" width="75" height="18" rx="5" fill="#7C4DEF" />
    <Rect x="63" y="52" width="14" height="56" fill="#FFC94A" />
    <Rect x="32" y="58" width="75" height="9" fill="#FFC94A" />

    {/* padlock, pinned front-and-center on top of the box */}
    <Path
      d="M54 47a16 16 0 0 1 32 0v9"
      stroke="#F5B430"
      strokeWidth={8}
      strokeLinecap="round"
      fill="none"
    />
    <Rect x="47" y="54" width="46" height="35" rx="7" fill="#FFC94A" />
    <Circle cx="70" cy="68" r="6" fill="#7C4DEF" />
    <Rect x="67" y="70.5" width="6" height="10.5" rx="3" fill="#7C4DEF" />
  </Svg>
);

// src/auth/VerifyEmailGate.tsx — was a bare "email-outline" Eva icon above
// "Verify your email." An envelope with a checkmark badge reads as
// "confirmed"/"on its way", a more encouraging beat than a plain static
// envelope glyph for a screen whose whole point is "check your inbox, one
// more step and you're in."
// REVERTED from unDraw back to a hand-drawn scene, sized up -- see
// ArtGiftBox's own comment above for the licensing writeup.
export const ArtEmailSent: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 140 140">
    <Circle cx="70" cy="70" r="56" fill="#71717a0f" />
    <Ellipse cx="70" cy="108" rx="38" ry="6" fill="rgba(0,0,0,0.06)" />

    {/* envelope body + folded flap, drawn as two triangles over the body
        so the flap reads as a real fold, not a printed line */}
    <Rect x="30" y="48" width="80" height="54" rx="7" fill="#71717a" />
    <Path d="M30 56 L70 84 L110 56" stroke="#EAF2FF" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />

    {/* "sent/confirmed" badge, pinned to the envelope's corner */}
    <Circle cx="105" cy="96" r="19" fill="#0EAD69" />
    <Path
      d="M97 96l6 6 12-13"
      stroke="#FFFFFF"
      strokeWidth={4.5}
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
// REVERTED from unDraw back to a hand-drawn scene, sized up, with a small
// celebrating figure added (arms raised, Humaaans-style flat person) --
// see ArtGiftBox's own comment above for the licensing writeup.
export const ArtTrophy: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 140 140">
    <Circle cx="70" cy="70" r="56" fill="#FFC94A1a" />
    <Ellipse cx="70" cy="112" rx="34" ry="6" fill="rgba(0,0,0,0.06)" />

    {/* small celebrating figure, arms raised, off to the side of the cup */}
    <Circle cx="30" cy="80" r="10" fill="#71717a" />
    <Path d="M14 118c0-12 7-20 16-20s16 8 16 20z" fill="#71717a" />
    <Path d="M18 100c-4-8-3-16 1-20" stroke="#71717a" strokeWidth={5.5} strokeLinecap="round" fill="none" />
    <Path d="M42 100c4-8 3-16-1-20" stroke="#71717a" strokeWidth={5.5} strokeLinecap="round" fill="none" />

    {/* cup */}
    <Path d="M52 42h50v20a25 25 0 0 1-50 0z" fill="#FFC94A" />
    {/* handles */}
    <Path d="M52 47c-11 0-16 7-16 14s5 11 14 12" stroke="#F5B430" strokeWidth={5.5} strokeLinecap="round" fill="none" />
    <Path d="M102 47c11 0 16 7 16 14s-5 11-14 12" stroke="#F5B430" strokeWidth={5.5} strokeLinecap="round" fill="none" />
    {/* stem + base */}
    <Rect x="70" y="82" width="14" height="16" fill="#F5B430" />
    <Rect x="56" y="98" width="42" height="9" rx="3.5" fill="#F5B430" />
    <Rect x="49" y="107" width="56" height="8" rx="4" fill="#7C4DEF" />

    {/* sparkles */}
    <Path d="M100 26l2.7 6.3L109 35l-6.3 2.7L100 44l-2.7-6.3L91 35l6.3-2.7z" fill="#71717a" />
    <Circle cx="118" cy="60" r="4.5" fill="#71717a" />
  </Svg>
);

// src/more/CareerRoadmap.tsx's intro form (before a roadmap is generated)
// — had no icon at all, just description text straight into the form
// card. A winding road with a flag at the end matches the feature's own
// framing ("plans the real path to get there").
// REVERTED from unDraw back to a hand-drawn scene, sized up, with a small
// figure walking the road added -- see ArtGiftBox's own comment above for
// the licensing writeup.
export const ArtRoadmapPath: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 140 140">
    <Circle cx="70" cy="70" r="56" fill="#71717a0f" />
    <Ellipse cx="70" cy="114" rx="38" ry="6" fill="rgba(0,0,0,0.06)" />

    {/* winding road, drawn as one thick curved stroke with a lighter
        centerline dash on top */}
    <Path
      d="M26 106c9-16 0-26 14-35s7-21 21-28 9-18 25-20"
      stroke="#71717a"
      strokeWidth={14}
      strokeLinecap="round"
      fill="none"
    />
    <Path
      d="M26 106c9-16 0-26 14-35s7-21 21-28 9-18 25-20"
      stroke="#EAF2FF"
      strokeWidth={3}
      strokeDasharray="7 8"
      strokeLinecap="round"
      fill="none"
    />

    {/* small figure walking up the road, roughly mid-path */}
    <Circle cx="53" cy="76" r="8" fill="#71717a" />
    <Path d="M40 100c0-9.5 5.8-16 13-16s13 6.5 13 16z" fill="#71717a" />

    {/* flag, planted at the road's end */}
    <Rect x="86" y="16" width="5" height="30" rx="2.5" fill="#F5B430" />
    <Path d="M91 17l18 7-18 7z" fill="#FFC94A" />
  </Svg>
);

// REDESIGN (product follow-up: "the signpost doesn't fit — What's Next
// isn't just 'here's your path', it's about how to navigate a brand-new
// job: fitting in with a new team, knowing how to behave with colleagues,
// what to do in the first days"). A signpost reads as a generic "which
// way do I go" glyph with no people in it, which undersold the social
// side of the feature. This is a compass (finding your footing in an
// unfamiliar place) with two small colleague figures arriving together at
// its base — the "you're not navigating this alone" framing — used both
// on src/more/WhatsNext.tsx's intro screen and inside its offer-details
// bottom sheet.
// REVERTED from unDraw back to a hand-drawn scene, sized up -- see
// ArtGiftBox's own comment above for the licensing writeup. Keeps the
// "you're not navigating this alone" framing with two small flat figures
// rather than a single glyph.
export const ArtWorkplaceCompass: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 140 140">
    <Circle cx="70" cy="68" r="56" fill="#71717a0f" />
    <Ellipse cx="70" cy="120" rx="38" ry="6" fill="rgba(0,0,0,0.06)" />

    {/* compass */}
    <Circle cx="70" cy="56" r="35" fill="#EAF2FF" />
    <Circle cx="70" cy="56" r="35" fill="none" stroke="#71717a" strokeWidth={6} />
    <Path d="M70 29l8 26-8 26-8-26z" fill="#FFC94A" />
    <Path d="M70 29l8 26h-8z" fill="#F5B430" />
    <Path d="M70 83l-8-26h8z" fill="#7C4DEF" />
    <Circle cx="70" cy="56" r="4.5" fill="#71717a" />

    {/* two colleagues, arriving together at the destination */}
    <Circle cx="46" cy="104" r="8" fill="#71717a" />
    <Path d="M32 130c0-11 6.3-18.5 14-18.5s14 7.5 14 18.5z" fill="#71717a" />
    <Circle cx="94" cy="104" r="8" fill="#71717a" />
    <Path d="M80 130c0-11 6.3-18.5 14-18.5s14 7.5 14 18.5z" fill="#71717a" />
  </Svg>
);

// src/more/JDAnalyzer.tsx's intro (before a JD is analyzed) — had no icon
// on the screen at all, just the paste-text/paste-URL tabs. A magnifying
// glass over a document reads as "we're going to examine this posting."
// HOME REDESIGN (product reference — a "Today's Mission" hero card: a
// phone showing a profile, with a floating checkmark badge and a floating
// star badge, standing on a small podium) — originally built translucent-
// white for a saturated brand-blue card fill.
//
// RETINTED (product follow-up: "the document icon you place at the top
// right corner of the hero card is not visible") — MissionHeroCard.tsx's
// card fill moved to white (background-basic-color-2) in an earlier pass,
// which left every one of this illustration's white/translucent-white
// shapes invisible against it (only the two opaque badge circles still
// showed). Converted to the same solid-brand-tint-shapes-on-pale-backdrop
// construction ArtDreamCompany/ArtMagnifyingDoc/ArtLearningCourses above
// already use for white cards: solid brand-blue phone body, pale-blue
// screen + profile glyph, same two real-color badges (green check, gold
// star) for the pop accent.
// REVERTED from unDraw back to a hand-drawn scene -- see ArtGiftBox's own
// comment above for the licensing writeup. NOT sized up at its one call
// site (MissionHeroCard.tsx, size=42) -- that size was deliberately
// shrunk from 64 -> 48 -> 42 across two earlier product reports asking to
// reduce this specific card's height, a different, already-negotiated
// constraint that "make illustrations moderate" shouldn't undo.
export const ArtMissionPhone: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 140 140">
    <Circle cx="70" cy="72" r="56" fill="#71717a0f" />

    {/* podium */}
    <Ellipse cx="66" cy="120" rx="40" ry="10" fill="rgba(0,0,0,0.06)" />
    <Ellipse cx="66" cy="114" rx="40" ry="10" fill="#C7DBFF" />

    {/* phone */}
    <Rect x="34" y="30" width="64" height="90" rx="14" fill="#71717a" />
    <Rect x="42" y="40" width="48" height="62" rx="6" fill="#EAF2FF" />
    <Circle cx="66" cy="58" r="11" fill="#C7DBFF" />
    <Path d="M50 88c0-10 7.2-17 16-17s16 7 16 17z" fill="#C7DBFF" />
    <Rect x="48" y="94" width="36" height="4" rx="2" fill="#C7DBFF" />

    {/* checkmark badge, top-right of the phone */}
    <Circle cx="102" cy="46" r="14" fill="#0EAD69" />
    <Path d="M95 46l5 5 9-10" stroke="#FFFFFF" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />

    {/* star badge, lower-right of the phone */}
    <Circle cx="108" cy="92" r="12" fill="#FFC94A" />
    <Path
      d="M108 84.5l2.3 4.7 5.2 0.7-3.8 3.7 0.9 5.1-4.6-2.4-4.6 2.4 0.9-5.1-3.8-3.7 5.2-0.7z"
      fill="#FFFFFF"
    />

    {/* sparkles */}
    <Polygon points="24,50 26,56 32,58 26,60 24,66 22,60 16,58 22,56" fill="#71717a" opacity={0.5} />
    <Circle cx="112" cy="24" r="3" fill="#71717a" opacity={0.45} />
  </Svg>
);

// Small corner accents for HomeSrc.tsx's Roadmap Progress / Current
// Streak stat mini-cards (see components/StatMiniCard.tsx) — much simpler
// than every scene above since these sit at ~36-44px in the corner of an
// already-small tile, not as the illustration a whole card is built
// around. Flat, 2-3 shapes each, same "no gradients/strokes-as-outline"
// convention as every other Home illustration in this file.
export const ArtMountainPeak: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 48 48">
    <Path d="M4 40L18 16l7 10 4-6 15 20z" fill="#71717a" opacity={0.18} />
    <Path d="M18 16l12 24H4z" fill="#71717a" opacity={0.5} />
    <Path d="M32 22l12 18H24z" fill="#71717a" opacity={0.32} />
    <Path d="M18 16l4 8-4 5-4-5z" fill="#FFFFFF" opacity={0.7} />
  </Svg>
);

export const ArtStreakFlame: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 48 48">
    <Path
      d="M24 6c2 6-4 8-4 14a8 8 0 0 0 16 0c0-4-2-6-3-8 0 3-2 4-3 3 1-6-2-9-6-9z"
      fill="#FFC94A"
    />
    <Path
      d="M24 18c1 4-2 5-2 9a6 6 0 0 0 12 0c0-2-1-4-2-5 0 2-1.5 2.5-2 2 0-3.5-2-5-6-6z"
      fill="#F2954A"
    />
  </Svg>
);

// src/auth/Login/Login.tsx's "Welcome back!" screen (product report:
// "There is no image or illustrations or icon in the welcome screen") — was
// just the brand wordmark followed straight into a big text heading and the
// email/password form, no illustration at all. A friendly waving figure
// with a small chat-bubble accent ties into the app's actual pitch (an AI
// Career Coach greeting you back) rather than a generic unrelated scene,
// using the same person-figure construction ArtWorkplaceCompass above
// already established (circle head + a single body path) plus the same
// pinned-badge convention every other illustration in this file uses for
// its accent piece.
export const ArtWelcomeWave: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    <Circle cx="60" cy="62" r="48" fill="#71717a0f" />
    <Ellipse cx="56" cy="104" rx="30" ry="5" fill="rgba(0,0,0,0.06)" />

    {/* figure — head + body, brand blue */}
    <Circle cx="52" cy="52" r="14" fill="#71717a" />
    <Path d="M32 100c0-15.5 9-26 20-26s20 10.5 20 26z" fill="#71717a" />

    {/* raised waving arm, a rounded stroke so it reads as a limb rather
        than a flat shape, with a small hand at the tip */}
    <Path
      d="M64 78c8-2 14-10 14-20"
      stroke="#71717a"
      strokeWidth={7}
      strokeLinecap="round"
      fill="none"
    />
    <Circle cx="78" cy="58" r="6.5" fill="#71717a" />

    {/* chat-bubble accent, top-right — the AI Coach "greeting" beat, same
        pinned-badge placement ArtMissionPhone/ArtDreamCompany use */}
    <Path
      d="M78 20h28a8 8 0 0 1 8 8v14a8 8 0 0 1-8 8h-8l-6 8v-8h-14a8 8 0 0 1-8-8V28a8 8 0 0 1 8-8z"
      fill="#FFC94A"
    />
    <Circle cx="88" cy="34" r="2.6" fill="#FFFFFF" />
    <Circle cx="97" cy="34" r="2.6" fill="#FFFFFF" />
    <Circle cx="106" cy="34" r="2.6" fill="#FFFFFF" />
  </Svg>
);

// REVERTED from unDraw back to a hand-drawn scene, sized up, with a small
// figure holding the magnifying glass added -- see ArtGiftBox's own
// comment above for the licensing writeup.
export const ArtMagnifyingDoc: React.FC<ArtProps> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 140 140">
    <Circle cx="70" cy="70" r="56" fill="#71717a0f" />
    <Ellipse cx="63" cy="114" rx="34" ry="6" fill="rgba(0,0,0,0.06)" />

    {/* document */}
    <Rect x="30" y="24" width="62" height="78" rx="6" fill="#EAF2FF" />
    <Rect x="42" y="42" width="38" height="6" rx="3" fill="#71717a" />
    <Rect x="42" y="57" width="38" height="6" rx="3" fill="#C7DBFF" />
    <Rect x="42" y="72" width="26" height="6" rx="3" fill="#C7DBFF" />

    {/* small figure peeking from behind the document, holding the glass */}
    <Circle cx="98" cy="52" r="9" fill="#71717a" />
    <Path d="M84 78c0-10 6.3-17 14-17s14 7 14 17z" fill="#71717a" />

    {/* magnifying glass, overlapping the document's bottom-right corner */}
    <Circle cx="90" cy="86" r="20" fill="none" stroke="#71717a" strokeWidth={8} />
    <Line x1="104" y1="100" x2="118" y2="114" stroke="#71717a" strokeWidth={8} strokeLinecap="round" />
  </Svg>
);
