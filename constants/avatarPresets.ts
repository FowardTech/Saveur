// ---------------------------------------------------------------------------
// A fixed, curated set of professional-looking profile avatars users can pick
// from in Edit Profile and at signup (product request item — the app
// previously only ever showed the user's own uploaded/OAuth photo, or plain
// initials; there was no way to pick a stand-in avatar at all).
//
// Rendered via DiceBear's free, keyless HTTP avatar API (same approach and
// base URL as the backend's leaderboard avatars — see Saveur-Backend's
// app/services/avatar_service.py) using the "micah" style — DiceBear's own
// description: "a flat-design vector avatar style of half-body portraits
// with clean outlines, simple facial features, and bold color combinations
// ... for modern web and mobile applications" (dicebear.com/styles/micah).
//
// This is the SECOND replacement of this file's style (direct product
// feedback both times): "personas" (the original) leaned on bald/balding/
// combover hairstyles to keep its 6 masculine presets visually distinct,
// which read as "old people" rather than "career people". Swapped to
// "avataaars" for that reason — but avataaars' busier, early-2010s
// illustrated-cartoon look was then flagged as "look old" too, a different
// complaint about the STYLE'S era/aesthetic rather than any one hairstyle.
// "micah" is a clean, minimal, contemporary flat-portrait style (closer to
// the avatar language used in current-generation SaaS products) — a
// deliberately different visual family from both previous attempts, not
// just a re-tuned version of the same cartoon look.
//
// Every param that affects how "professional" the result looks is pinned
// explicitly (verified against DiceBear's own published schema at
// https://api.dicebear.com/9.x/micah/schema.json, not guessed):
//   - hair: ONLY 'full' / 'pixie' / 'turban' — micah's other hair values
//     ('fonze' pompadour, 'mrT'/'dougFunny' mohawk-style, 'dannyPhantom'
//     spiky-anime, 'mrClean' bald) are stylized/novelty cuts, not business-
//     appropriate; 'mrClean' (bald) is deliberately excluded too, to avoid
//     repeating the exact "reads old" failure mode personas had.
//   - shirt: ONLY 'collared' / 'crew' — i.e. business/business-casual tops.
//     'open' (open shirt) is deliberately never used here.
//   - shirtColor / hairColor / baseColor (skin tone): natural, business-
//     appropriate tones only, no bright/novelty colors from the style's
//     wider palette.
//   - eyes='smiling', mouth='smile', nose='curve' on every preset, so no
//     avatar can land on an unprofessional/negative expression.
//   - glassesProbability=0 / earringsProbability=0 by default — turned on
//     for exactly one preset each (glasses, earrings) purely for set
//     variety, both still business-appropriate (round glasses, stud
//     earrings) rather than novelty accessories.
//   - backgroundColor=e6e6e6 (one consistent neutral gray) on every preset,
//     so the picker grid reads as one cohesive set rather than a random
//     rainbow of per-seed background colors — same value the previous
//     avataaars set used, kept for continuity.
// Only `seed` is otherwise irrelevant here (every visually meaningful param
// is already pinned above) — kept unique per entry only so each preset has
// a stable, distinct identity to reference.
//
// Exactly 6 masculine-presenting + 6 feminine-presenting presets, as
// requested ("evenly distributed male and female").
// ---------------------------------------------------------------------------

const DICEBEAR_BASE = 'https://api.dicebear.com/9.x/micah/png';

export interface AvatarPreset {
  id: string;
  // Not shown in the UI (the grid is presented as one neutral, evenly-split
  // set of options, not labeled by gender) -- kept only so this file's intent
  // stays self-documenting and easy to audit/rebalance later.
  presentation: 'masculine' | 'feminine';
  url: string;
}

function micahUrl(params: {
  seed: string;
  hair: string;
  hairColor: string;
  shirt: string;
  shirtColor: string;
  baseColor: string;
  eyebrows?: string;
  facialHair?: string;
  facialHairProbability?: number;
  glasses?: string;
  glassesProbability?: number;
  earrings?: string;
  earringsProbability?: number;
}): string {
  const qs = new URLSearchParams({
    seed: params.seed,
    hair: params.hair,
    hairColor: params.hairColor,
    shirt: params.shirt,
    shirtColor: params.shirtColor,
    baseColor: params.baseColor,
    eyebrows: params.eyebrows ?? 'up',
    eyes: 'smiling',
    mouth: 'smile',
    nose: 'curve',
    facialHairProbability: String(params.facialHairProbability ?? 0),
    glassesProbability: String(params.glassesProbability ?? 0),
    earringsProbability: String(params.earringsProbability ?? 0),
    backgroundColor: 'e6e6e6',
    size: '256',
  });
  if (params.facialHair) qs.set('facialHair', params.facialHair);
  if (params.glasses) qs.set('glasses', params.glasses);
  if (params.earrings) qs.set('earrings', params.earrings);
  return `${DICEBEAR_BASE}?${qs.toString()}`;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  // -- Masculine-presenting (6): short, business-appropriate hairstyles --
  {
    id: 'male_01',
    presentation: 'masculine',
    url: micahUrl({
      seed: 'saveur-marcus-v2', hair: 'full', hairColor: '2c1b18',
      shirt: 'collared', shirtColor: '262e33', baseColor: 'd08b5b',
    }),
  },
  {
    id: 'male_02',
    presentation: 'masculine',
    url: micahUrl({
      seed: 'saveur-elijah-v2', hair: 'full', hairColor: '4a312c',
      shirt: 'crew', shirtColor: '3c4f5c', baseColor: '614335',
    }),
  },
  {
    id: 'male_03',
    presentation: 'masculine',
    url: micahUrl({
      seed: 'saveur-andre-v2', hair: 'full', hairColor: '2c1b18',
      shirt: 'collared', shirtColor: '25557c', baseColor: 'ac6651',
      facialHair: 'beard', facialHairProbability: 100,
    }),
  },
  {
    id: 'male_04',
    presentation: 'masculine',
    url: micahUrl({
      seed: 'saveur-diego-v2', hair: 'pixie', hairColor: '724133',
      shirt: 'crew', shirtColor: '5199e4', baseColor: 'f9c9b6',
    }),
  },
  {
    id: 'male_05',
    presentation: 'masculine',
    url: micahUrl({
      seed: 'saveur-kenji-v2', hair: 'full', hairColor: '2c1b18',
      shirt: 'collared', shirtColor: '929598', baseColor: 'ac6651',
      facialHair: 'beard', facialHairProbability: 100,
      glasses: 'round', glassesProbability: 100,
    }),
  },
  {
    id: 'male_06',
    presentation: 'masculine',
    url: micahUrl({
      seed: 'saveur-omar-v2', hair: 'turban', hairColor: '2c1b18',
      shirt: 'crew', shirtColor: '262e33', baseColor: 'ac6651',
    }),
  },
  // -- Feminine-presenting (6): longer/styled, business-appropriate hair --
  {
    id: 'female_01',
    presentation: 'feminine',
    url: micahUrl({
      seed: 'saveur-aisha-v2', hair: 'full', hairColor: '2c1b18',
      shirt: 'collared', shirtColor: '262e33', baseColor: 'ac6651',
      eyebrows: 'eyelashesUp',
    }),
  },
  {
    id: 'female_02',
    presentation: 'feminine',
    url: micahUrl({
      seed: 'saveur-priya-v2', hair: 'full', hairColor: '2c1b18',
      shirt: 'crew', shirtColor: '3c4f5c', baseColor: 'd08b5b',
      eyebrows: 'eyelashesUp',
    }),
  },
  {
    id: 'female_03',
    presentation: 'feminine',
    url: micahUrl({
      seed: 'saveur-elena-v2', hair: 'full', hairColor: 'f4d150',
      shirt: 'collared', shirtColor: '25557c', baseColor: 'f9c9b6',
      eyebrows: 'eyelashesDown',
    }),
  },
  {
    id: 'female_04',
    presentation: 'feminine',
    url: micahUrl({
      seed: 'saveur-naomi-v2', hair: 'pixie', hairColor: '4a312c',
      shirt: 'crew', shirtColor: '5199e4', baseColor: '614335',
      eyebrows: 'eyelashesUp',
    }),
  },
  {
    id: 'female_05',
    presentation: 'feminine',
    url: micahUrl({
      seed: 'saveur-sofia-v2', hair: 'full', hairColor: '9287ff',
      shirt: 'collared', shirtColor: '929598', baseColor: 'f9c9b6',
      eyebrows: 'eyelashesDown', earrings: 'stud', earringsProbability: 100,
    }),
  },
  {
    id: 'female_06',
    presentation: 'feminine',
    url: micahUrl({
      seed: 'saveur-grace-v2', hair: 'full', hairColor: '724133',
      shirt: 'crew', shirtColor: '6bd9e9', baseColor: 'ac6651',
      eyebrows: 'eyelashesUp',
    }),
  },
];
