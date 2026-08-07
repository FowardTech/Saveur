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
 *
 * BUG FIX (product report: "the end interview just keep saying ending
 * interview and it refuses to let me close... it just freezes the screen")
 * — the original version above only protected against `promise` HANGING
 * (never settling). It did nothing for `promise` REJECTING quickly (a real
 * native error — e.g. Voice.stop() failing, or VisionCamera's recording
 * finalize throwing instead of just being slow) — `Promise.race` propagates
 * a rejection the instant it happens, same as if withTimeout didn't exist
 * at all. Every one of onEnd's 3 withTimeout calls sits BEFORE onEnd's own
 * try/catch/finally block, so that rejection threw straight out of onEnd(),
 * which (a) never reached the `finally { navigate(...) }` that takes the
 * user to Feedback, and (b) never reset `isEnding`, which is exactly what
 * onCloseAttempt (the X button) and the End Interview button both check to
 * decide whether to do anything — so the user was left on this screen
 * forever with both exits silently no-op'd. Catching the rejection here and
 * resolving with `fallback` instead makes withTimeout live up to its own
 * docstring above ("no matter what any individual native call does") for
 * BOTH of the ways a promise can fail to deliver a real value in time, not
 * just one of them.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  const guarded = promise.catch(() => fallback);
  return Promise.race([
    guarded,
    new Promise<T>(resolve => {
      setTimeout(() => resolve(fallback), ms);
    }),
  ]);
}
