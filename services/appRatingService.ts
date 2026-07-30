import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// appRatingService — in-app rating prompt (product request item: "a regular
// if not weekly or monthly app rating that will pop up as modal... seen in
// the admin and the user that sent the ratings too... for quality
// assurance purposes"). Backed by Saveur-Backend's app/api/ratings.py.
//
// Due-ness is server-authoritative (GET /status) rather than a client-side
// AsyncStorage timer — survives reinstall, and a user can't dodge a QA
// signal forever just by reinstalling the app.
// ---------------------------------------------------------------------------

export interface AppRatingProps {
  id: number;
  score: number;
  comment: string | null;
  createdAt: string;
}

interface RatingWire {
  id?: number;
  score?: number;
  comment?: string | null;
  created_at?: string | null;
}

function fromWire(r: RatingWire): AppRatingProps {
  return {
    id: r.id ?? 0,
    score: r.score ?? 0,
    comment: r.comment ?? null,
    createdAt: r.created_at ?? '',
  };
}

/** GET /api/v1/ratings/status — whether the rating modal should show right
 * now. Fails closed (false) on any error — a broken network call should
 * never itself be the reason an unrelated screen suddenly shows a modal. */
export async function isRatingPromptDue(): Promise<boolean> {
  try {
    const {data} = await apiClient.get<{due?: boolean}>('/api/v1/ratings/status');
    return Boolean(data?.due);
  } catch {
    return false;
  }
}

/** POST /api/v1/ratings — submit {score: 1-5, comment?}. Also marks the
 * prompt as shown server-side (see the backend route's own comment), so
 * the next due-check naturally waits a full interval again. */
export async function submitRating(score: number, comment?: string): Promise<AppRatingProps> {
  const {data} = await apiClient.post<RatingWire>('/api/v1/ratings', {
    score,
    comment: comment?.trim() || undefined,
  });
  return fromWire(data);
}

/** POST /api/v1/ratings/dismiss — the user closed the modal without rating.
 * Still updates the server-side "last shown" timestamp so they aren't
 * re-asked again until the next interval. */
export async function dismissRatingPrompt(): Promise<void> {
  await apiClient.post('/api/v1/ratings/dismiss');
}

/** GET /api/v1/ratings/mine — the signed-in user's own past submitted
 * ratings, newest first (product direction: visible to "the user that sent
 * the ratings too", not just the admin dashboard). */
export async function getMyRatings(): Promise<AppRatingProps[]> {
  const {data} = await apiClient.get<{ratings?: RatingWire[]}>('/api/v1/ratings/mine');
  return (data.ratings ?? []).map(fromWire);
}
