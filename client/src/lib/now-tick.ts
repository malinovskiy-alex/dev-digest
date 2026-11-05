/**
 * How often a relative time ("4 minutes ago") re-renders, ms. One value for
 * every `useNow({ updateInterval })` in the studio, so the same clock moves at
 * the same pace on every screen (PR Brief, Onboarding Tour, Agent Performance).
 */
export const NOW_TICK_MS = 60_000;
