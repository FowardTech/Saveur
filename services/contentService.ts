import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './apiClient';
import i18n from 'i18next';

// ---------------------------------------------------------------------------
// contentService — admin-editable legal/policy content (privacy policy,
// terms of service). GET /api/v1/content/legal/{slug} is public (no auth) —
// see the backend's app/api/content.py. Backs src/more/policyScreen, which
// previously bundled static placeholder copy that could only ever change
// with a new app-store release; this now reflects whatever's currently
// published from the admin dashboard's Content page.
// ---------------------------------------------------------------------------

export type LegalSlug = 'privacy_policy' | 'terms_of_service';

export interface LegalContent {
  slug: string;
  title: string;
  bodyMd: string;
  updatedAt: number | null;
}

interface LegalContentWire {
  slug: string;
  title?: string;
  body_md?: string;
  updated_at?: string | null;
}

function fromWire(wire: LegalContentWire): LegalContent {
  return {
    slug: wire.slug,
    title: wire.title ?? '',
    bodyMd: wire.body_md ?? '',
    updatedAt: wire.updated_at ? new Date(wire.updated_at).getTime() : null,
  };
}

// Cache key includes the language — see getLegalContent's BUG FIX comment
// below on why this now sends `language` at all. Without the language in
// the key, switching languages while offline (or before the first online
// fetch in the new language completes) could otherwise serve back a stale
// cached copy in the PREVIOUS language instead of a genuine (even if
// English-fallback) result.
const cacheKey = (slug: string, lang: string) => `legalContent:${slug}:${lang}`;

const readCache = async (slug: string, lang: string): Promise<LegalContent | null> => {
  const raw = await AsyncStorage.getItem(cacheKey(slug, lang));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LegalContent;
  } catch {
    return null;
  }
};

const writeCache = async (slug: string, lang: string, content: LegalContent): Promise<LegalContent> => {
  await AsyncStorage.setItem(cacheKey(slug, lang), JSON.stringify(content));
  return content;
};

/**
 * GET /api/v1/content/legal/{slug} — falls back to the last-known cache if
 * offline, so the policy screen isn't ever blank just because there's no
 * network. The backend itself always returns something (a genuine default
 * if no admin override has been published yet), so this should rarely need
 * the cache in practice.
 *
 * BUG FIX (product report: "privacy & terms screen" body text stuck in
 * English regardless of language) — this previously never told the backend
 * what language to respond in at all, so GET /content/legal/{slug} always
 * returned the single admin-authored English copy no matter the user's
 * selected language. Now sends the current i18next language exactly like
 * every other language-aware service call in this app (see e.g.
 * services/coachService.ts, careerOsService.ts) — the backend translates
 * and caches the result server-side (see app/api/content.py).
 */
export async function getLegalContent(slug: LegalSlug): Promise<LegalContent> {
  const lang = i18n.language || 'en';
  try {
    const {data} = await apiClient.get<LegalContentWire>(`/api/v1/content/legal/${slug}`, {params: {language: lang}});
    return writeCache(slug, lang, fromWire(data));
  } catch {
    const cached = await readCache(slug, lang);
    if (cached) return cached;
    return {slug, title: '', bodyMd: '', updatedAt: null};
  }
}
