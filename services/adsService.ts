import apiClient from './apiClient';
import {AdvertisementProps} from 'constants/Types';

// ---------------------------------------------------------------------------
// adsService — admin-configured in-app advert popup (see saveur-backend's
// app/api/ads.py + app/models/advertisement.py). The admin dashboard owns
// creating/editing ads and setting "how many times it should show"
// (max_impressions, enforced per-user server-side) — this file only
// consumes that:
//   GET  /api/v1/ads/next             — the next ad this user hasn't
//                                        exhausted their view cap on yet
//   POST /api/v1/ads/<id>/impression  — record that it was actually shown
//
// Mirrors the existing "AI Coach feedback ready" popup pattern
// (navigation/MainBottomTab.tsx) — see src/home/HomeSrc.tsx for where this
// gets wired into a popup, and src/more/AdDetails.tsx for the screen a tap
// opens.
// ---------------------------------------------------------------------------

interface AdWire {
  id?: number;
  title?: string;
  body?: string;
  image_url?: string;
  detail_body?: string;
  cta_url?: string;
  cta_label?: string;
}

function fromWire(wire: AdWire): AdvertisementProps | null {
  if (!wire || !wire.id || !wire.title || !wire.body || !wire.detail_body) return null;
  return {
    id: wire.id,
    title: wire.title,
    body: wire.body,
    imageUrl: wire.image_url || undefined,
    detailBody: wire.detail_body,
    ctaUrl: wire.cta_url || undefined,
    ctaLabel: wire.cta_label || undefined,
  };
}

/**
 * GET /api/v1/ads/next. Returns null if there's nothing eligible left for
 * this user (every active ad already hit its own max_impressions for them,
 * or there are no active ads at all) — an empty `{}` body from the backend
 * maps to null here rather than a fake/partial ad object.
 */
export async function getNextAd(): Promise<AdvertisementProps | null> {
  const {data} = await apiClient.get<AdWire>('/api/v1/ads/next');
  return fromWire(data);
}

/**
 * POST /api/v1/ads/<id>/impression — call once the popup has actually
 * rendered on screen, not just been fetched, so a fetched-but-never-shown
 * ad doesn't silently burn one of its limited impressions.
 */
export async function recordImpression(adId: number): Promise<void> {
  await apiClient.post(`/api/v1/ads/${adId}/impression`);
}

/**
 * GET /api/v1/ads/banner — the current admin-configured Home-screen banner
 * (placement="home_banner" on the backend), or null if none is active.
 * Unlike getNextAd, this is never impression-capped and has no "record
 * impression" call — see src/home/HomeSrc.tsx for where this renders as a
 * persistent tappable card above the Today's Goal Tips card, and
 * src/more/AdDetails.tsx for the screen tapping it opens (same screen the
 * popup ad already uses — the row shape is identical either way).
 */
export async function getHomeBanner(): Promise<AdvertisementProps | null> {
  const {data} = await apiClient.get<AdWire>('/api/v1/ads/banner');
  return fromWire(data);
}
