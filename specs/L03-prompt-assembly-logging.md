# L03 — Safe structured logging of prompt assembly

**Goal:** when a review or intent prompt is assembled, the API log records what
went into it — each section's name, source, trust, and size — along with the
model and a correlation ID. No prompt text is logged.
**Not in scope:** logging prompt *content* in any mode; a UI for these logs; a
real tokenizer (sizes are `chars` + `approx_tokens = ceil(chars / 4)`).

## Touches
reviewer-core: `prompt.ts` (section metadata), `review/run.ts` (`onPrompt` hook)
· server: `platform/prompt-log.ts` (new), `platform/config.ts`, `app.ts` (pino
`redact`), `modules/reviews/run-executor.ts`, `modules/reviews/intent/*`,
`.env.example`, `README.md` env table · no contract change in `@devdigest/shared`.

## Design
1. **Metadata only, by type.**
   - `PromptSectionMeta` = `{ name, source, trust, chars, approx_tokens, items?, fingerprint }`. It has **no text field**.
   - `assemblePrompt` returns `sections: PromptSectionMeta[]`. The intent classifier builds the same shape with `describeClassifierInput`.
   - The logger accepts only this type, so content cannot reach it by accident.
2. **Review prompts.**
   - `reviewPullRequest` calls an injected `onPrompt({ chunk, index, total, mode, model, sections })` before every LLM call, once per chunk in map-reduce.
   - reviewer-core stays free of I/O: logging is the caller's job.
3. **Correlation ID.**
   - A review uses its `runId`, and the chunk index goes in its own field.
   - Intent derived during a review uses the batch's run IDs.
   - Intent derived from `GET`/`POST /pulls/:id/intent` uses the Fastify request id (`req.id`).
4. **Default line** (`info`, `event: "prompt.assembled"`):
   - fields: `correlation_id`, `kind` (`review` | `intent`), `provider`, `model`, `pr_id`, `run_id?`, `agent?`, `chunk {index,total}`, `total_chars`, `total_approx_tokens`;
   - per section: `name`, `source`, `trust`, `chars`, `approx_tokens`.
5. **Verbose mode**, only locally:
   - It turns on with `PROMPT_LOG_VERBOSE=true` **and** `NODE_ENV=development`. In any other environment the flag is ignored, and the API warns once at boot.
   - It adds a second line, `event: "prompt.assembled.detail"`, with:
     - per section: `items` (char lengths of individual skills, specs, memory items or classifier sources) and `fingerprint` (a hash of the section text, so two runs can be compared);
     - the chunk label (a file path in map-reduce).
   - Still no content.
6. **Never logged in any mode:**
   - the diff;
   - spec, ticket or description text;
   - skill bodies;
   - the system prompt text;
   - API keys and tokens.

   As a second line of defence, pino gets a `redact` list for authorization headers, cookies and `*.apiKey` / `*.token` / `*.password` / `*.secret` fields.

## Done when
- [ ] a review run writes one `prompt.assembled` line per LLM call, and its `correlation_id` equals the run id
- [ ] intent derivation writes a `prompt.assembled` line with `kind: "intent"`
- [ ] with `PROMPT_LOG_VERBOSE=true` and `NODE_ENV=development`, a `prompt.assembled.detail` line follows each one; with `NODE_ENV=production`, it does not
- [ ] no log line contains a diff line, spec, ticket or description text (unit tests assert this)
- [ ] typecheck, arch and the tests of all three packages pass against the baseline
