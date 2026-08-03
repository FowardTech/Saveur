// ---------------------------------------------------------------------------
// jobLocation — small shared helper for "is this job remote?" (product
// request, ApplicationItem.tsx card: "It should show the location and also
// if its remote or not").
//
// There is no structured remote/workplace-type flag anywhere in this app's
// data model to read instead — job listings come from an LLM web search
// (Saveur-Backend's job_search_service.py, JOBS_SCHEMA) that only returns a
// free-text `location` string, and neither the JobAlert nor Application
// backend models have a dedicated remote column. Real job listings/boards
// very commonly put "Remote" directly in that location string ("Remote",
// "Remote - USA", "San Francisco, CA (Remote)", etc.), so a simple
// case-insensitive substring check on the location text this app already
// has is the practical signal available, rather than inventing a whole new
// structured field the actual job source doesn't provide.
// ---------------------------------------------------------------------------
export function isRemoteLocation(location?: string | null): boolean {
  if (!location) return false;
  return /\bremote\b/i.test(location);
}
