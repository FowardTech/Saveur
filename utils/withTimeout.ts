/**
 * Races `promise` against a plain timer. If `promise` hasn't settled within
 * `ms`, resolves with `fallback` instead and lets `promise` keep running
 * detached in the background (whatever it eventually does — including
 * throwing — is still handled by its own existing `.catch`/`try` inside
 * `promise` itself; `Promise.race` internally attaches a handler to every
 * promise it's given, so this never produces an "unhandled rejection").
 *
 * Exists for exactly one reason (product bug fix): a handful of awaits in
 * the video interview end-of-session teardown (LiveInterviewSession.tsx's
 * onEnd) have NO timeout of their own — a native-module bridge promise
 * (react-native-voice's Voice.stop()) or a VisionCamera recording-finalize
 * callback that never fires would hang that `await` forever, which in turn
 * blocked `navigate()` forever, which is exactly what "stuck on Saving your
 * Recording" was. Wrapping each of those awaits in withTimeout gives every
 * step in that chain a hard ceiling, so the user is always eventually taken
 * to the Feedback screen no matter what any individual native call does.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => {
      setTimeout(() => resolve(fallback), ms);
    }),
  ]);
}
