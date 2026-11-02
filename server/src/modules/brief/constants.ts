/**
 * PR Brief (L05) — literals, limits, job kind and fixed messages.
 * Each value names the requirement or decision it implements
 * (`specs/L05-pr-brief.requirements.md`, `specs/L05-pr-brief.md`).
 */

/** R-19: the model input (system + user) is at most 8,000 tokens ≈ 32,000 chars. */
export const INPUT_BUDGET_CHARS = 32_000;
/** R-19: the size estimate — ceil(chars / 4), not a tokenizer. */
export const CHARS_PER_TOKEN = 4;

/** R-73, D-38: output cap for a non-reasoning model. */
export const OUTPUT_MAX_TOKENS = 2_000;
/** R-73, D-38: wall around the one call for a non-reasoning model. */
export const GENERATION_TIMEOUT_MS = 60_000;
/** R-73, D-38: output cap for a reasoning model (reasoning tokens count against it). */
export const REASONING_OUTPUT_MAX_TOKENS = 10_000;
/** R-73, D-38: wall around the one call for a reasoning model. */
export const REASONING_TIMEOUT_MS = 120_000;
/** R-73, D-38: a model id (its segment after the last `/`) starting with one of these is a reasoning model. */
export const REASONING_MODEL_PREFIXES = ['o1', 'o3', 'o4'] as const;
/** R-73, D-38: a model id (its segment after the last `/`) containing one of these is a reasoning model. */
export const REASONING_MODEL_MARKERS = ['gpt-5', 'deepseek-r1', 'deepseek-v4', 'qwq', 'reasoning', 'thinking'] as const;

/** R-12: the adapter must never re-ask the model — one call per generation. */
export const GENERATION_MAX_RETRIES = 0;
/** R-26: the same facts give the same answer as far as the provider allows. */
export const GENERATION_TEMPERATURE = 0;

/** R-35: at most this many risks after grounding. */
export const MAX_RISKS = 5;
/** R-35: at most this many Review focus items after grounding. */
export const MAX_FOCUS = 6;
/** R-35: the summary is cut to this many characters. */
export const SUMMARY_MAX_CHARS = 600;

/** F-27: caps on model-written risk and focus text (stored and served; the schema stays constraint-free). */
export const RISK_KIND_MAX_CHARS = 40;
export const RISK_TITLE_MAX_CHARS = 200;
export const RISK_EXPLANATION_MAX_CHARS = 1_000;
export const FOCUS_REASON_MAX_CHARS = 300;

/** R-64: the linked issue's body is cut to this many characters before the budget. */
export const ISSUE_BODY_MAX_CHARS = 4_000;
/** R-21, R-24: appended to a text the budget cut. */
export const TRUNCATED_MARKER = '[truncated]';
/** R-60: a provider's error message is cut to this many characters. */
export const FAILURE_MESSAGE_MAX = 300;

/** D-6: the `JobRunner` kind of one brief generation. */
export const BRIEF_JOB_KIND = 'pr-brief-generate';
/** D-21: name of the structured-output schema sent to the provider. */
export const BRIEF_SCHEMA_NAME = 'PrBriefAnswer';
/** R-12: the system prompt file under `src/prompts/`. */
export const BRIEF_PROMPT_FILE = 'brief.system.md';

/** R-15: error code of the 409 while a generation runs. */
export const BRIEF_RUNNING = 'brief_generation_running';
/** R-39: error code of the 409 when the provider has no key. */
export const BRIEF_NO_KEY = 'brief_no_api_key';

/** R-15: message of the 409 while a generation runs (verbatim). */
export const RUNNING_MESSAGE = 'A brief is already being generated for this PR';
/** R-38: failure message for an answer that does not validate (verbatim). */
export const INVALID_OUTPUT_MESSAGE = 'The model returned invalid output';
/** R-60: failure message for a call that hit its wall (verbatim). */
export const TIMEOUT_MESSAGE = 'timed out';
/** D-7: failure message when the job runner failed before the handler ran. */
export const JOB_NOT_STARTED_MESSAGE = 'The generation could not start';
/** Step 10c: failure message when the brief could not be written. */
export const STORE_FAILED_MESSAGE = 'Could not save the brief';
/** D-8: the 404 message of a PR unknown to the workspace (R-18). */
export const PULL_NOT_FOUND_MESSAGE = 'Pull request not found';

/** F-06: per-route limit on POST /pulls/:id/brief/generate (each accepted call may cost a model call). */
export const GENERATE_RATE_LIMIT_MAX = 10;
export const GENERATE_RATE_LIMIT_WINDOW = '1 minute';
/** F-08: concurrent agent reads while collecting the specs input. */
export const SPEC_READ_CONCURRENCY = 4;
/** F-12: JobRunner's default per-handler wall (`platform/jobs.ts`, `timeoutMs ?? 120_000`), mirrored here — jobs.ts stays untouched. */
export const JOB_WALL_MS = 120_000;
/** F-12: what the generation leaves of that wall for storing the brief and logging. */
export const JOB_WALL_MARGIN_MS = 5_000;
/** F-04: the failure text shown when something other than the model call failed (the cause goes to the log only). */
export const GENERATION_FAILED_MESSAGE = 'The brief could not be generated';
/** F-17: how long a polling GET may reuse the feature-model and key reads while a generation runs. */
export const VIEW_STATE_TTL_MS = 5_000;
