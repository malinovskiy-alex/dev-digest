# reviewer-core/docs/

Deep-dives into the engine beyond the pipeline diagram in
[`../README.md`](../README.md).

Candidates to write as they come up: the prompt section order and why it is that
order, the grounding gate's rules and its full-file exceptions, structured-output
repair and the retry budget, the reduce/score derivation, the threat model behind
`INJECTION_GUARD` and what it deliberately does not do, cost and token
accounting across chunks.

Rules: one topic per file, Mermaid for diagrams, reference code by path instead
of pasting it. Plans go to [`../specs/`](../specs/), gotchas to
[`../INSIGHTS.md`](../INSIGHTS.md).
