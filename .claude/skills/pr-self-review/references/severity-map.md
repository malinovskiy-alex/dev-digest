# Severity map — what each lens's "bad" means here

Of the thirteen skills in `.claude/skills/`, **two** carry a severity vocabulary
of their own:

- `react-best-practices` tags rules CRITICAL / HIGH / MEDIUM, explicitly "for use
  by consuming agents";
- `security` grades by confidence: HIGH (pattern + confirmed attacker-controlled
  input) / MEDIUM (source unclear) / LOW (theoretical).

The other eleven say "do this, not that" with no gradation. Without a mapping,
"critical finding" means a different thing per lens, and the block rule stops
meaning anything. This file is that mapping.

The target vocabulary is `Severity` from
`server/src/vendor/shared/contracts/findings.ts:11` — `CRITICAL`, `WARNING`,
`SUGGESTION` — and the definition of CRITICAL is
`docs/agent-prompts/general-reviewer.md:53-73`, read verbatim:

> **CRITICAL** — a defect that, once merged, can cause a security breach, data
> loss or corruption, or a production outage.
> Style, or "I would have done it elsewhere", is at most a WARNING, never CRITICAL.

## Per lens

### `security` (+ `docs/agent-prompts/security-reviewer.md`)

| Its grade | Ours |
|---|---|
| HIGH — vulnerable pattern **and** confirmed attacker-controlled input | CRITICAL, `category: security` |
| MEDIUM — pattern, input source unclear | WARNING |
| LOW — theoretical / best-practice deviation | not reported |

Its own `Do NOT flag` list applies as written: test files, dead code,
server-controlled values, framework-mitigated patterns, `NODE_ENV`-gated code.

### `react-best-practices`

| Its tag | Ours |
|---|---|
| CRITICAL — broken reconciliation, state bugs | WARNING, or CRITICAL only when the diff shows real data loss or a crash path |
| HIGH — performance / scaling | WARNING |
| MEDIUM — maintainability | SUGGESTION |

Note the deliberate downgrade: that skill's "CRITICAL" is written against
component health, not against the merge bar. A missing `key` prop does not take
production down.

### `onion-architecture`

| Situation | Ours |
|---|---|
| `pnpm arch` fails on a **new** boundary violation | CRITICAL, `category: bug` — machine-verified, no judgement involved |
| in the 25 grandfathered entries of `.dependency-cruiser-known-violations.json` | not reported |
| business rule moved into `routes.ts` with no import to betray it (invisible to the graph) | WARNING |
| a service that would need Postgres to unit-test | WARNING |
| ring shape the skill would prefer, no rule broken | SUGGESTION |

### `fastify-best-practices`, `drizzle-orm-patterns`, `next-best-practices`, `frontend-ui-architecture`, `typescript-expert`, `react-testing-library`

Reference material, not rubrics. Default **SUGGESTION**, raised to WARNING when
the diff shows a concrete consequence (an unhandled rejection, a query with no
`limit` on a growing table, a client component that will not hydrate). CRITICAL
only via a rule that is machine-checked elsewhere — never on this lens's word
alone.

### `postgresql-table-design`

| Situation | Ours |
|---|---|
| a migration that drops or rewrites a column with data | CRITICAL |
| missing `NOT NULL` / constraint on a new column | WARNING |
| type or index preference | SUGGESTION |

### `zod`

| Situation | Ours |
|---|---|
| request input reaching a handler unvalidated | CRITICAL |
| contract widened or nullability changed with consumers unaware | WARNING |
| schema style, `.parse` vs `.safeParse` preference | SUGGESTION |

### `perf-prompt` (`docs/agent-prompts/performance-reviewer.md`)

Its own rule — "report only findings with a concrete mechanism, not speculation"
— decides admission. Then:

| Situation | Ours |
|---|---|
| connection-pool starvation, unbounded fan-out, event-loop blocking on a request path | CRITICAL |
| N+1, missing index, over-fetching | WARNING |
| micro-optimisation | SUGGESTION |

### `/code-review`

Keeps its own severity. Map its top tier to CRITICAL only when §4 of `SKILL.md`
is satisfied: grounded in a real hunk, confidence ≥ 0.7.

### Gates (`gate` lens)

Fixed, not a judgement call — see [gates.md](gates.md). G1, G2, G3, G4, G8, G9
are CRITICAL; G5, G10, G11, G12 and the CRLF check are WARNING; G6, G7 are
SUGGESTION.

## Drift

These mappings cite a file and a line rather than copying values. If `Severity`
or `CiFailOn` changes in the contracts, eval case 7 (`severity-drift`) fails and
this file is what gets fixed.
