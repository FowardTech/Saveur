// ---------------------------------------------------------------------------
// A fixed, curated set of professional-looking profile avatars users can pick
// from in Edit Profile and at signup (product request item — the app
// previously only ever showed the user's own uploaded/OAuth photo, or plain
// initials; there was no way to pick a stand-in avatar at all).
//
// Rendered via DiceBear's free, keyless HTTP avatar API (same approach and
// base URL as the backend's leaderboard avatars — see Saveur-Backend's
// app/services/avatar_service.py) using the "avataaars" style — DiceBear's
// best-known, business-casual illustrated style (bold, colorful, half-body
// characters), NOT the "personas" style this file used previously.
//
// Why the switch: personas' 6 masculine presets leaned on `bald`, `balding`,
// and `shortCombover` hairstyles to keep them visually distinct from each
// other, which combined with that style's muted, mature rendering read as
// "old people" rather than "career people" (direct product feedback — the
// whole reason this file changed). avataaars' own `top` (hairstyle) enum
// has NO bald/comb-over/receding-hairline option at all — every avatar has a
// full head of hair (or, unused here, a hat/hijab/turban) — so that specific
// failure mode isn't reachable no matter which style option is picked below.
//
// Every param that affects how "professional" the result looks is pinned
// explicitly (verified against DiceBear's own published schema at
// https://api.dicebear.com/9.x/avataaars/schema.json, not guessed):
//   - clothing: ONLY blazerAndShirt / blazerAndSweater / collarAndSweater /
//     shirtCrewNeck / shirtScoopNeck / shirtVNeck — i.e. business/business-
//     casual tops. hoodie / overall / graphicShirt (also valid enum values)
//     are deliberately never used here.
//   - clothesColor: ONLY a business-appropriate subset of the style's own
//     palette (charcoal/navy/slate/blue/gray) — never the bright
//     pink/yellow/red options also in that same enum.
//   - hairColor / skinColor: natural tones only, from the style's own palette.
//   - eyes=default, eyebrows=defaultNatural, mouth=smile on every preset, so
//     no avatar can randomly land on an unprofessional expression.
//   - accessoriesProbability=0 — no sunglasses/eyepatch.
//   - backgroundColor=e6e6e6 (one consistent neutral gray) on every preset,
//     so the picker grid reads as one cohesive set rather than a random
//     rainbow of per-seed background colors.
// Only `seed` is otherwise irrelevant here (every visually meaningful param
// is already pinned above) — kept unique per entry only so each preset has
// a stable, distinct identity to reference.
//
// Exactly 6 masculine-presenting + 6 feminine-presenting presets, as
// requested ("evenly distributed male and female").
// ---------------------------------------------------------------------------

const DICEBEAR_BASE = 'https://api.dicebear.com/9.x/avataaars/png';

export interface AvatarPreset {
  id: string;
  // Not shown in the UI (the grid is presented as one neutral, evenly-split
  // set of options, not labeled by gender) -- kept only so this file's intent
  // stays self-documenting and easy to audit/rebalance later.
  presentation: 'masculine' | 'feminine';
  url: string;
}

function avataaarsUrl(params: {
  seed: string;
  top: string;
  clothing: string;
  clothesColor: string;
  hairColor: string;
  skinColor: string;
  facialHair?: string;
  facialHairProbability: number;
}): string {
  const qs = new URLSearchParams({
    seed: params.seed,
    top: params.top,
    clothing: params.clothing,
    clothesColor: params.clothesColor,
    hairColor: params.hairColor,
    skinColor: params.skinColor,
    facialHairProbability: String(params.facialHairProbability),
    accessoriesProbability: '0',
    eyes: 'default',
    eyebrows: 'defaultNatural',
    mouth: 'smile',
    backgroundColor: 'e6e6e6',
    size: '256',
  });
  if (params.facialHair) qs.set('facialHair', params.facialHair);
  return `${DICEBEAR_BASE}?${qs.toString()}`;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  // -- Masculine-presenting (6): short, business-appropriate hairstyles --
  {
    id: 'male_01',
    presentation: 'masculine',
    url: avataaarsUrl({
      seed: 'saveur-marcus', top: 'shortFlat', clothing: 'blazerAndShirt',
      clothesColor: '262e33', hairColor: '2c1b18', skinColor: 'd08b5b', facialHairProbability: 0,
    }),
  },
  {
    id: 'male_02',
    presentation: 'masculine',
    url: avataaarsUrl({
      seed: 'saveur-elijah', top: 'shortWaved', clothing: 'collarAndSweater',
      clothesColor: '3c4f5c', hairColor: '4a312c', skinColor: '614335', facialHairProbability: 0,
    }),
  },
  {
    id: 'male_03',
    presentation: 'masculine',
    url: avataaarsUrl({
      seed: 'saveur-andre', top: 'shortRound', clothing: 'blazerAndSweater',
      clothesColor: '25557c', hairColor: '2c1b18', skinColor: 'ae5d29',
      facialHair: 'beardLight', facialHairProbability: 100,
    }),
  },
  {
    id: 'male_04',
    presentation: 'masculine',
    url: avataaarsUrl({
      seed: 'saveur-diego', top: 'theCaesar', clothing: 'shirtCrewNeck',
      clothesColor: '5199e4', hairColor: '724133', skinColor: 'edb98a', facialHairProbability: 0,
    }),
  },
  {
    id: 'male_05',
    presentation: 'masculine',
    url: avataaarsUrl({
      seed: 'saveur-kenji', top: 'theCaesarAndSidePart', clothing: 'blazerAndShirt',
      clothesColor: '929598', hairColor: '2c1b18', skinColor: 'ffdbb4',
      facialHair: 'beardMedium', facialHairProbability: 100,
    }),
  },
  {
    id: 'male_06',
    presentation: 'masculine',
    url: avataaarsUrl({
      seed: 'saveur-omar', top: 'sides', clothing: 'shirtVNeck',
      clothesColor: '262e33', hairColor: '4a312c', skinColor: 'fd9841', facialHairProbability: 0,
    }),
  },
  // -- Feminine-presenting (6): longer/styled, business-appropriate hair --
  {
    id: 'female_01',
    presentation: 'feminine',
    url: avataaarsUrl({
      seed: 'saveur-aisha', top: 'bob', clothing: 'blazerAndShirt',
      clothesColor: '262e33', hairColor: '2c1b18', skinColor: 'ae5d29', facialHairProbability: 0,
    }),
  },
  {
    id: 'female_02',
    presentation: 'feminine',
    url: avataaarsUrl({
      seed: 'saveur-priya', top: 'straight01', clothing: 'collarAndSweater',
      clothesColor: '3c4f5c', hairColor: '2c1b18', skinColor: 'd08b5b', facialHairProbability: 0,
    }),
  },
  {
    id: 'female_03',
    presentation: 'feminine',
    url: avataaarsUrl({
      seed: 'saveur-elena', top: 'straight02', clothing: 'blazerAndSweater',
      clothesColor: '25557c', hairColor: 'b58143', skinColor: 'ffdbb4', facialHairProbability: 0,
    }),
  },
  {
    id: 'female_04',
    presentation: 'feminine',
    url: avataaarsUrl({
      seed: 'saveur-naomi', top: 'straightAndStrand', clothing: 'shirtScoopNeck',
      clothesColor: '5199e4', hairColor: '4a312c', skinColor: '614335', facialHairProbability: 0,
    }),
  },
  {
    id: 'female_05',
    presentation: 'feminine',
    url: avataaarsUrl({
      seed: 'saveur-sofia', top: 'longButNotTooLong', clothing: 'shirtVNeck',
      clothesColor: '929598', hairColor: 'd6b370', skinColor: 'edb98a', facialHairProbability: 0,
    }),
  },
  {
    id: 'female_06',
    presentation: 'feminine',
    url: avataaarsUrl({
      seed: 'saveur-grace', top: 'bun', clothing: 'blazerAndShirt',
      clothesColor: '65c9ff', hairColor: '724133', skinColor: 'fd9841', facialHairProbability: 0,
    }),
  },
];
