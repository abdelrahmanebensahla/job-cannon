import { useSyncExternalStore } from 'react';

// A subscribe that never fires: hydration is a one-way latch, so there are no
// store updates to listen for. Module-level so the reference stays stable and
// useSyncExternalStore doesn't resubscribe on every render.
const emptySubscribe = () => () => {};

/**
 * `false` on the server and during the first client (hydration) render, then
 * `true` once mounted on the client. Use it to gate client-only output behind a
 * stable placeholder so the server and initial-client markup match.
 *
 * This is the hydration-safe replacement for the
 * `useState(false)` + `useEffect(() => setMounted(true), [])` idiom, which trips
 * `react-hooks/set-state-in-effect`. `useSyncExternalStore` returns the server
 * snapshot during hydration and swaps to the client snapshot in a follow-up
 * render — no synchronous setState in an effect.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
