import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './apiClient';

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

const cacheKey = (slug: string) => `legalContent:${slug}`;

const readCache = async (slug: string): Promise<LegalContent | null> => {
  const raw = await AsyncStorage.getItem(cacheKey(slug));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LegalContent;
  } catch {
    return null;
  }
};

const writeCache = async (slug: string, content: LegalContent): Promise<LegalContent> => {
  await AsyncStorage.setItem(cacheKey(slug), JSON.stringify(content));
  return content;
};

/**
 * GET /api/v1/content/legal/{slug} — falls back to the last-known cache if
 * offline, so the policy screen isn't ever blank just because there's no
 * network. The backend itself always returns something (a genuine default
 * if no admin override has been published yet), so this should rarely need
 * the cache in practice.
 */
export async function getLegalContent(slug: LegalSlug): Promise<LegalContent> {
  try {
    const {data} = await apiClient.get<LegalContentWire>(`/api/v1/content/legal/${slug}`);
    return writeCache(slug, fromWire(data));
  } catch {
    const cached = await readCache(slug);
    if (cached) return cached;
    return {slug, title: '', bodyMd: '', updatedAt: null};
  }
}
