/** Constants for the settings module. */
import type { ConnTestProvider, SecretKey } from '@devdigest/shared';

/** Provider id used by the GitHub connection test branch. */
export const GITHUB_PROVIDER = 'github';

/**
 * Bounds on the poll interval, in minutes.
 *
 * The floor keeps a misconfigured workspace from hammering GitHub's REST quota;
 * the ceiling is what a "still polling" claim in the UI can honestly stand
 * behind. Both are stated here rather than inline in the contract so the two
 * numbers have one home and a reader can see them together.
 */
export const MIN_POLL_INTERVAL_MIN = 1;
export const MAX_POLL_INTERVAL_MIN = 60;
export const DEFAULT_POLL_INTERVAL_MIN = 15;

/** Maps a connection-test provider to the SecretsProvider key it persists to. */
export const SECRET_KEY_BY_PROVIDER: Record<ConnTestProvider, SecretKey> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  github: 'GITHUB_TOKEN',
};
