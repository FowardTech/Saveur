// ---------------------------------------------------------------------------
// A fixed, curated set of professional-looking profile avatars users can pick
// from in Edit Profile (product request item — the app previously only ever
// showed the user's own uploaded/OAuth photo, or plain initials; there was no
// way to pick a stand-in avatar at all).
//
// Rendered via DiceBear's free, keyless HTTP avatar API (same approach and
// base URL as the backend's leaderboard avatars — see Saveur-Backend's
// app/services/avatar_service.py) using the "personas" style: flat-design,
// half-body characters with subtle skin shading — DiceBear's own description.
// Deliberately NOT one of the cartoonish/childlike styles (e.g. "adventurer",
// "big-smile", "bottts") the leaderboard defaults to, since those are what
// prompted this request in the first place ("professional looking avatar...
// not baby like").
//
// Every preset pins `hair` (and `facialHair`/`facialHairProbability` for the
// masculine-presenting half) so gender presentation is deliberate rather than
// left to DiceBear's per-seed randomization, and pins `mouth=smile` +
// `eyes=open` on every preset so no avatar can randomly land on an
// unprofessional expression (DiceBear's default pool includes things like a
// "pacifier" mouth or "sleep"/"wink" eyes, which is the opposite of what was
// asked for here). Only `seed` (which drives skin tone, hair color, clothing
// color, and clothing shape) is left to vary per preset, so the 12 options
// still look visually distinct from each other despite the shared style.
//
// Exactly 6 masculine-presenting + 6 feminine-presenting presets, as
// requested ("evenly distributed male and female").
// ---------------------------------------------------------------------------

const DICEBEAR_BASE = 'https://api.dicebear.com/9.x/personas/png';

export interface AvatarPreset {
  id: string;
  // Not shown in the UI (the grid is presented as one neutral, evenly-split
  // set of options, not labeled by gender) -- kept only so this file's intent
  // stays self-documenting and easy to audit/rebalance later.
  presentation: 'masculine' | 'feminine';
  url: string;
}

function personaUrl(params: {
  seed: string;
  hair: string;
  facialHair?: string;
  facialHairProbability: number;
}): string {
  const qs = new URLSearchParams({
    seed: params.seed,
    hair: params.hair,
    facialHairProbability: String(params.facialHairProbability),
    mouth: 'smile',
    eyes: 'open',
    size: '256',
  });
  if (params.facialHair) qs.set('facialHair', params.facialHair);
  return `${DICEBEAR_BASE}?${qs.toString()}`;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  // -- Masculine-presenting (6): short/no hair, optional facial hair --
  {
    id: 'male_01',
    presentation: 'masculine',
    url: personaUrl({seed: 'saveur-marcus', hair: 'buzzcut', facialHair: 'shadow', facialHairProbability: 100}),
  },
  {
    id: 'male_02',
    presentation: 'masculine',
    url: personaUrl({seed: 'saveur-elijah', hair: 'fade', facialHairProbability: 0}),
  },
  {
    id: 'male_03',
    presentation: 'masculine',
    url: personaUrl({seed: 'saveur-andre', hair: 'shortCombover', facialHairProbability: 0}),
  },
  {
    id: 'male_04',
    presentation: 'masculine',
    url: personaUrl({seed: 'saveur-diego', hair: 'sideShave', facialHair: 'goatee', facialHairProbability: 100}),
  },
  {
    id: 'male_05',
    presentation: 'masculine',
    url: personaUrl({seed: 'saveur-kenji', hair: 'bald', facialHair: 'beardMustache', facialHairProbability: 100}),
  },
  {
    id: 'male_06',
    presentation: 'masculine',
    url: personaUrl({seed: 'saveur-omar', hair: 'balding', facialHairProbability: 0}),
  },
  // -- Feminine-presenting (6): longer/styled hair, no facial hair --
  {
    id: 'female_01',
    presentation: 'feminine',
    url: personaUrl({seed: 'saveur-aisha', hair: 'bobCut', facialHairProbability: 0}),
  },
  {
    id: 'female_02',
    presentation: 'feminine',
    url: personaUrl({seed: 'saveur-priya', hair: 'bobBangs', facialHairProbability: 0}),
  },
  {
    id: 'female_03',
    presentation: 'feminine',
    url: personaUrl({seed: 'saveur-elena', hair: 'long', facialHairProbability: 0}),
  },
  {
    id: 'female_04',
    presentation: 'feminine',
    url: personaUrl({seed: 'saveur-naomi', hair: 'extraLong', facialHairProbability: 0}),
  },
  {
    id: 'female_05',
    presentation: 'feminine',
    url: personaUrl({seed: 'saveur-sofia', hair: 'straightBun', facialHairProbability: 0}),
  },
  {
    id: 'female_06',
    presentation: 'feminine',
    url: personaUrl({seed: 'saveur-grace', hair: 'curlyBun', facialHairProbability: 0}),
  },
];
