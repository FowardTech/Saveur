// Dependency-free credits store/event hub. Lives apart from creditsService.ts
// so services/apiClient.ts can emit "out of credits" / "balance is stale"
// events without importing the service layer (which itself imports apiClient
// -> a require cycle) or the native in-app-purchase module.
type Listener = () => void;
export type InsufficientPayload = {message?: string; required?: number; available?: number};

let current: unknown = null;
const listeners = new Set<Listener>();
let refresher: (() => void) | null = null;
let staleTimer: ReturnType<typeof setTimeout> | null = null;
let insufficientHandler: ((p: InsufficientPayload) => void) | null = null;

export const getCurrent = <T>() => current as T | null;
export function setCurrent(value: unknown) {
  current = value;
  listeners.forEach(l => l());
}
export function subscribe(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
export function setRefresher(fn: (() => void) | null) {
  refresher = fn;
}
/** Called by apiClient after any successful write (debounced refetch). */
export function markCreditsStale() {
  if (staleTimer) clearTimeout(staleTimer);
  staleTimer = setTimeout(() => refresher?.(), 800);
}
export function setInsufficientCreditsHandler(fn: ((p: InsufficientPayload) => void) | null) {
  insufficientHandler = fn;
}
export function emitInsufficientCredits(p: InsufficientPayload) {
  refresher?.();
  insufficientHandler?.(p);
}
