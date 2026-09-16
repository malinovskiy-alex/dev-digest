# docs/ — cross-package documentation

Durable explanations of how DevDigest works and why it is built this way.
Package-specific docs live in `server/docs/`, `client/docs/`,
`reviewer-core/docs/`, `e2e/docs/`.

What belongs here: architecture decisions, subsystem deep-dives, anything true
across more than one package. What does not: plans for unbuilt features
([`../specs/`](../specs/)), hard-won gotchas ([`../INSIGHTS.md`](../INSIGHTS.md)),
setup instructions ([`../README.md`](../README.md)).

## Index

- [`agent-prompts/`](agent-prompts/) — the built-in reviewer system prompts and
  how to pick a model: [general](agent-prompts/general-reviewer.md) ·
  [security](agent-prompts/security-reviewer.md) ·
  [performance](agent-prompts/performance-reviewer.md) ·
  [choosing a model](agent-prompts/choosing-a-model.md).

## Writing a doc

One topic per file, kebab-case name, an H1 and a one-sentence summary at the
top. Diagrams in Mermaid (the `mermaid-diagram` skill), because the client
already renders them. Link to code as `path/to/file.ts` rather than pasting it —
pasted code goes stale, paths do not.
