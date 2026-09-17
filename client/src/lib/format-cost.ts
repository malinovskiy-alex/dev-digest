/**
 * Per-run cost formatting, shared by the three surfaces that show it: the PR
 * list's Cost column, the PR-detail timeline, and the run-trace stats tile.
 *
 * ONE adaptive rule, deliberately not the per-screen precision the mockups
 * drew — the same run must read the same everywhere, so a cent-scale run does
 * not show as "$0.001" in one place and "$0.0013" in another.
 */

/** Below this, three decimals would round a real cost to "$0.000". */
const SUB_CENT = 0.01;
/** Below this, even four decimals round to zero — say so instead of lying. */
const FLOOR = 0.0001;

/**
 * USD for one run. `null`/`undefined` → an em dash: an unknown model price
 * means UNKNOWN, never free, so this never renders "$0.00".
 */
export function formatCostUsd(usd: number | null | undefined): string {
  if (usd == null || Number.isNaN(usd)) return "—";
  if (usd === 0) return "$0.000";
  if (usd < FLOOR) return "<$0.0001";
  return usd < SUB_CENT ? `$${usd.toFixed(4)}` : `$${usd.toFixed(3)}`;
}

/**
 * Total tokens for one run, grouped ("9,119"). Returns null when the run
 * reported neither side — an errored run shows no token line at all.
 */
export function formatTokensTotal(
  tokensIn: number | null | undefined,
  tokensOut: number | null | undefined,
): string | null {
  if (tokensIn == null && tokensOut == null) return null;
  const total = (tokensIn ?? 0) + (tokensOut ?? 0);
  // Fixed locale: the value is a count, and the tests assert on the string.
  return total.toLocaleString("en-US");
}
