import prettyMs from 'pretty-ms';

/**
 * Human-readable PR age for the Pull Requests list ("3d 4h", "12m").
 *
 * Pure — takes `now` as a parameter so it unit-tests without fake timers.
 */
export function formatPrAge(openedAt: string, now: Date = new Date()): string {
  const opened = Date.parse(openedAt);
  if (Number.isNaN(opened)) throw new Error(`Invalid openedAt: ${openedAt}`);

  const elapsed = (now.getTime() - opened) / 1000;
  return prettyMs(elapsed, { compact: true });
}
