import type { SkillType } from '@devdigest/shared';

/**
 * Built-in skill bodies used by the seed (L02).
 *
 * A skill is TEXT — it is rendered into the review prompt's `## Skills / rules`
 * section by `assemblePrompt` and read by the model as instructions. It cannot
 * run anything, read a file, or call out. See
 * `specs/L02-skills-in-the-product.md` D6 for why these sit OUTSIDE the
 * `<untrusted>` delimiters that wrap the diff.
 *
 * Why these are skills and not prompt text: each one is a specific, listable
 * procedure. The agent's system prompt carries the role and the
 * severity/verdict conventions; the enumerable checks live here, so they can be
 * attached, reordered, disabled, and — the point of the lesson — observed in
 * the run trace as their own block. `flake-patterns` is deliberately NOT here:
 * it ships as `server/fixtures/skills/flake-patterns.zip` so the import path is
 * exercised end to end.
 *
 * Keep each body self-contained. A skill may be attached to an agent whose
 * prompt never mentions it, so it cannot rely on wording from elsewhere.
 */

export interface SeedSkill {
  name: string;
  description: string;
  type: SkillType;
  body: string;
}

/**
 * The description is the skill's INTERFACE — written as a directive, in the
 * imperative, so a reader (or a future router) can tell from one line whether
 * this skill applies. Not "about mocking"; "Flag tests that mock the unit under
 * test".
 */
export const UNCOVERED_BRANCH_GATE: SeedSkill = {
  name: 'uncovered-branch-gate',
  description:
    'Enumerate every branch of each function changed in the diff and report the ones no test reaches.',
  type: 'rubric',
  body: `# Uncovered branch gate

Do this before you write any finding about test coverage.

## 1. Enumerate the branches

For every function added or changed in the diff, list its branch points in
order. A branch point is any place control can go more than one way:

- an \`if\` / \`else if\` / \`else\`, including one without a body
- a ternary, a \`??\`, a \`||\` or \`&&\` used for control rather than value
- a \`switch\` case, and the absent \`default\`
- an early \`return\`, \`continue\`, \`break\` or \`throw\`
- a \`catch\`, and a \`finally\` that can alter the outcome
- an optional parameter or a default value — the caller who omits it is a branch
- a loop that can execute zero times

Count the zero-iteration path and the \`else\` that was never written. "There is
no else branch" is not the same as "the else case is covered": if the condition
can be false and nothing handles it, that is a path with behaviour.

## 2. Mark off what the tests actually reach

For each branch, find the test that would FAIL if that branch's behaviour
changed. Not a test that merely executes the line — a test whose assertion
constrains what the line does. A test that calls the function and asserts it did
not throw leaves every branch below it unmarked.

## 3. Report what is left

Report one finding per uncovered branch, and in it:

- cite the **production** \`file:line\` of the branch, never the test file
- name the input that reaches it — "\`pct\` greater than 100", not "the error path"
- name the observable consequence of it being wrong — what the caller would see

If a branch is uncovered but its behaviour is genuinely inconsequential, say so
and drop it rather than filing a SUGGESTION. Volume here is worse than silence:
a reviewer who lists every unreached line trains the author to skim.

## Severity for this rubric

- **CRITICAL** — the uncovered branch guards money, data loss, auth, or a
  documented contract, and its failure is silent.
- **WARNING** — an uncovered branch with real behaviour and a visible failure.
- **SUGGESTION** — an uncovered branch whose behaviour is trivially correct by
  inspection.`,
};

export const CORNER_CASE_CHECKLIST: SeedSkill = {
  name: 'corner-case-checklist',
  description:
    'Walk the corner-case checklist against each signature changed in the diff and report the untested cases that carry real behaviour.',
  type: 'rubric',
  body: `# Corner case checklist

For each function, route handler or exported signature changed in the diff, walk
this list against its **parameters and its return value**. The list is a prompt
for your attention, not a quota — most entries will not apply, and an entry that
does not apply is not a finding.

## The list

| Case | Ask |
|---|---|
| empty | zero-length string, array, map, result set — what does it return? |
| absent | \`null\`, \`undefined\`, a missing optional argument, an absent key |
| boundary | the exact value at each comparison in the body, and one either side |
| sign & zero | negative where positive is assumed; zero where non-zero is assumed |
| overflow | a value large enough to change type behaviour, or a count that exceeds a limit |
| duplicate | the same item twice; a repeated call with the same input |
| ordering | input arriving in a different order, or out of order |
| unicode | multi-byte characters, combining marks, an emoji in a length check |
| whitespace | leading, trailing, and interior — especially before a comparison |
| timezone & clock | a date at a DST boundary, a UTC/local mismatch, a clock that moves backwards |
| concurrency | two callers at once against shared state; the same row written twice |
| failure | the dependency throws, times out, or returns a partial result |

## How to apply it

1. Read the signature. For each parameter, walk the rows that can apply to its
   type and ask what the body does with that value.
2. Check the **boundary** row against every comparison operator in the body. A
   \`>\` and a \`>=\` differ by exactly one input, and that input is the test worth
   asking for.
3. For each case where the answer is behaviour the author clearly intended, look
   for the test. Report the ones with no test.

## Reporting

One finding per untested case that carries real behaviour. Name the concrete
input and the expected result — "an empty \`items\` array returns \`NaN\` from the
average, and no test covers it" — not the category name. A finding that says
"missing edge case tests" is not actionable and should not be filed.

Do not report a case whose behaviour is undefined by design and documented as
such. Do not report the same input twice under two different rows.`,
};

export const OVER_MOCKING_GATE: SeedSkill = {
  name: 'over-mocking-gate',
  description:
    'Flag tests that mock the unit under test or assert on a mock instead of on observable behaviour.',
  type: 'convention',
  body: `# Over-mocking gate

A mock is a stand-in for something the test does not own. When a test mocks the
thing it is supposed to be testing, it stops proving anything: it passes because
the mock was configured to make it pass, and it will keep passing after the real
implementation breaks.

## Flag these

1. **The unit under test is mocked.** The module, class or function named in the
   test's description is itself stubbed, wholly or in part. Includes partial
   mocks that replace the one method the test then asserts on.

2. **The assertion is on the mock, not on the outcome.** The test ends with
   \`expect(mock).toHaveBeenCalledWith(...)\` and nothing else. That asserts the
   code called a collaborator, which is an implementation detail — it will fail
   on a harmless refactor and pass on a behavioural regression. Ask instead what
   the caller observes: a return value, a thrown error, a row written, a response
   body.

   A call assertion is legitimate when the call **is** the observable effect —
   an email sent, a webhook posted, a metric emitted. Then it is the outcome,
   and it is not a finding.

3. **The mock encodes the answer.** The stub returns exactly the value the
   assertion expects, so the production code between them could be deleted and
   the test would still pass. Ask: what is left for this test to verify?

4. **Everything is mocked.** Every collaborator is stubbed and the test asserts
   on wiring only. Such a test pins the current call graph in place and reports
   every refactor as a failure, while a real defect in any of the logic passes
   untouched.

5. **A pure function is mocked.** A collaborator with no I/O, no clock and no
   randomness should be called for real. Mocking it removes the integration it
   was cheap to keep.

## Do not flag

Mocking genuine boundaries: the network, the filesystem, the clock, randomness,
a paid third-party API, or a dependency whose setup would make a unit test an
integration test. That is what mocks are for.

## Reporting

Cite the test's \`file:line\` and name what the test would fail to catch. "This
would still pass if \`applyDiscount\` returned a constant" is the sentence that
makes the finding land. Severity is WARNING by default; CRITICAL only when the
mocked-out behaviour is the one the PR exists to change.`,
};

export const API_CONTRACT_GATE: SeedSkill = {
  name: 'api-contract-gate',
  description:
    'Flag a changed exported signature, route path, parameter name or response shape whose callers were not updated in the same diff.',
  type: 'convention',
  body: `# API contract gate

A signature change is invisible in a diff that only shows the definition. The
call sites live in files the diff does not touch, which is exactly why they were
forgotten. Treat every changed interface as a breaking change until the diff
shows otherwise.

## What counts as a contract

- an exported function's parameter list: names, order, types, optionality
- a route's method, path, or path parameters
- the name or type of a query parameter, body field, or header a handler reads
- the shape of a response: a field added is usually safe, a field **renamed,
  removed, re-typed or made nullable** is not
- a status code, for a caller that branches on it
- a thrown error's type or code, for a caller that catches it
- an enum's members, a config key, an event name, a DB column a query selects
- the meaning of a value without its type changing — cents to dollars, seconds
  to milliseconds, inclusive to exclusive. This is the worst kind: every type
  checks and every caller is now wrong.

## How to check

1. List every contract the diff changes, using the list above.
2. For each, ask who calls it. Look for call sites **in the diff**. If the diff
   renames a parameter in the definition and no call site changed in the same
   diff, that is the finding — you do not need to see the caller to know it was
   not updated here.
3. Check the diff's own internal consistency first: a handler that now reads
   \`req.body.user\` while the validation schema still declares \`userId\` is a
   contract break visible entirely within the diff.
4. Check the tests. A test updated to match the new signature while no caller
   was proves the change was made deliberately in one place and not propagated.

## Reporting

One finding per broken contract. Cite the \`file:line\` of the definition that
changed, state the old shape and the new one, and name who breaks: "any caller
passing \`userId\`", "clients of \`POST /reviews\` sending the old body". Say
explicitly when you cannot see the call sites — "no caller was updated in this
diff" is an honest and useful finding; "this breaks 14 callers" is a guess.

Severity: **CRITICAL** when the contract is public or crosses a service boundary
and the change is silent at compile time. **WARNING** when it is internal and a
type checker would catch it. A field added to a response is normally not a
finding at all.`,
};

// ---------------------------------------------------------------------------
// L03 — the API-contract skills.
//
// The four rules the API Contract Reviewer sends, seeded together with that
// agent and with the control-experiment PRs #485/#486 in ./seed-fixtures.ts.
// They are a set on purpose: those fixtures' notes name these four, so seeding
// the PRs without them leaves a demo pointing at an empty workspace.
//
// Each body is self-contained, including its own severity scale, because a
// skill can be attached to an agent whose prompt never mentions it.
// ---------------------------------------------------------------------------


export const BREAKING_CHANGE: SeedSkill = {
  name: "breaking-change",
  description:
    "Classify every change to a published contract as breaking, behavioral or additive, and flag the breaking ones that ship with no deprecation and no version bump.",
  type: "convention",
  body: `
# Breaking change

A published contract has callers this repository cannot see: another service, a
CI job, a saved query, someone's script. They are not in the diff, so nothing
fails locally and nothing fails in review. Your job is to decide whether this
change is safe for them, and to say so out loud when it is not.

## 1. Is the thing public?

Public means "something outside this change depends on it and you cannot fix
them in this commit": an exported symbol of a published package, an HTTP route,
a response body, an error \`code\`, an enum serialized to storage, a DB column, a
config or env key, an event name, a CLI flag, a file format.

Not public: a module-private function, an internal type with no serialization
boundary, anything a type checker will catch at build time. Those belong to
\`api-contract-gate\`, not here.

## 2. Classify it — breaking, behavioural, or additive

**Breaking — the caller's existing code or data is now wrong.**

- \`send(to: string, body: string)\` → \`send(opts: { to, body })\`
- response field renamed or re-typed: \`{ accepted: boolean }\` → \`{ status: 'accepted' | 'rejected' }\`
- a request field that was optional becomes required
- a list response changes shape: \`Item[]\` → \`{ items: Item[], next: string }\`
- an error \`code\` a client branches on is renamed: \`not_found\` → \`missing\`
- an enum member is **removed**, or a DB column is dropped or renamed
- a **response** type is widened: \`string\` → \`string | null\`, because the client
  never had to handle null before
- the *meaning* changes while the type does not: \`timeout\` seconds → milliseconds,
  \`total\` cents → dollars, a range inclusive → exclusive. The worst kind: every
  type checks, every caller is silently wrong, nothing fails loudly.

**Additive — old callers keep working untouched.**

- a new **optional** request field, a new response field, a new endpoint
- a **request** type is widened: \`string\` → \`string | null\` accepts strictly more
- a previously required parameter gains a default
- an internal, non-exported symbol is renamed

Note the asymmetry, because it is where most wrong calls are made: widening is
safe on the way **in** and breaking on the way **out**. Narrowing is the
opposite. Adding an enum member is additive for a client that ignores unknown
values and breaking for one that switches exhaustively — say which you assumed.

## 3. Does it carry a way out?

A breaking change is not automatically a finding. It stops being one when the
diff itself contains the escape: a major version bump, the old name kept as a
deprecated alias, a migration that backfills, a dual-write/dual-read window, or
a documented cutoff. If you see any of these in the diff, say so and move on.

The finding is a breaking change that arrives **silently** — no bump, no alias,
no migration, no note.

## 4. Report it

**Bad finding — no field, no caller, no mechanism. Do not write these:**

> This is a breaking change to the API and may affect existing clients.

> The response shape changed, consider versioning.

**Good finding — names what was published, what replaced it, who is now wrong:**

> \`ConventionCandidate.accepted\` is removed (\`contracts/knowledge.ts:214\`) and
> replaced by \`status\`. Anything reading \`accepted\` off this payload now gets
> \`undefined\`, which is falsy — a rejected candidate and an accepted one become
> indistinguishable rather than erroring. No deprecation and no version bump in
> this diff.

> \`AgentConfig.timeout\` keeps its type \`number\` but is now milliseconds rather
> than seconds (\`config.ts:18\`). Every existing caller passing \`30\` now means
> 30ms. Nothing fails at compile time and nothing throws at runtime.

Say plainly when you cannot see the consumers: "no consumer of this field
appears in this diff" is honest and useful. "This breaks 14 clients" is a guess.

## Severity

- **CRITICAL** — a published contract is removed, renamed, re-typed or
  re-interpreted, with no deprecation, bump or migration in the same diff.
- **WARNING** — the same change with a partial escape (bump but no alias, alias
  but no cutoff), or a break whose consumers are all inside this repository.
- **SUGGESTION** — a naming or shape change that is safe today but will be a
  break the moment the surface is published.

An added response field is not a finding. An internal rename a type checker
catches is not a finding. "Might affect someone", with no named consumer and no
named assumption, is not a finding.`,
};


export const DEPRECATION_POLICY: SeedSkill = {
  name: "deprecation-policy",
  description:
    "Require a removal to arrive as the second half of a deprecation \u2014 the old path still working, a marker naming its replacement, and a stated end \u2014 and reject a marker that names neither.",
  type: "convention",
  body: `# Deprecation policy

Removal is the *second* release of a deprecation, never the first. A diff that
introduces the replacement and deletes the old thing in one change gives
consumers no window at all: they find out when their build breaks, and the only
remedy available to them is to not upgrade.

A deprecation that never ends is the opposite failure. A codebase full of
\`@deprecated\` markers with no removal date teaches everyone to ignore the
marker, which costs the same as not having one.

## 1. A deprecation has four parts

Check the diff for all four. Any one missing is the finding:

1. **The old path still works.** Same name, same signature, same route.
2. **A marker that names the replacement** — \`@deprecated Use \\\`sendMessage\\\`
   instead.\` A bare \`@deprecated\` tells a reader they are wrong without telling
   them what to do.
3. **A stated end** — a version or a date. "Removed in 3.0" or "removed after
   2026-06-01", in the marker itself, not in a ticket.
4. **The old path delegates to the new one.** One implementation, two names.

## 2. Delegate, never duplicate

The old entry point must call the new one. Copying the body leaves two
implementations that drift: the bug gets fixed in the new one, and every
consumer still on the old name keeps the bug.

**Bad — two bodies, one of which will rot:**

\`\`\`ts
/** @deprecated */
export function send(to: string, body: string) {
  const msg = { to, body, sentAt: Date.now() };
  return transport.write(msg);          // a copy
}
export function sendMessage(opts: SendOpts) {
  const msg = { ...opts, sentAt: Date.now() };
  return transport.write(msg);
}
\`\`\`

**Good — one body, and the marker says where to go and when it ends:**

\`\`\`ts
/** @deprecated Use \`sendMessage({ to, body })\`. Removed in 3.0. */
export function send(to: string, body: string) {
  return sendMessage({ to, body });
}
\`\`\`

## 3. Mechanics by surface

- **Exported symbol** — keep the old export as a delegating alias; mark it;
  remove it in the next major.
- **HTTP route** — keep serving it. Announce the end with \`Deprecation\` and
  \`Sunset\` response headers so a client can detect it without reading docs.
- **Response field** — keep sending the old field beside the new one for one
  release. Removing it is a response-shape break, not a deprecation, unless the
  old field stayed.
- **Enum member or config key** — accept both spellings and normalise at the
  edge, in one place, so the rest of the code only ever sees the new one.
- **Database column** — expand and contract: add the new column, backfill,
  dual-write, switch reads, and only then drop the old one — in a later
  migration, not this one. A migration that adds a column and drops its
  predecessor in the same file has no rollback that preserves data.

## 4. Deprecations that do not work

- a marker naming no replacement, or pointing at something that does not exist yet
- a marker with no end — deprecated forever is a comment, not a policy
- a removal that arrives before anything was ever marked
- a removal in a minor or patch release, however long the marker has been there
- a runtime warning on a hot path: one log line per call turns a deprecation
  into an outage. Warn once per process, or at startup
- a marker added in the same diff that does the removal

## 5. What the finding looks like

**Bad — restates the policy without pointing at anything:**

> Deprecated code should be removed gradually.

> Consider adding a deprecation warning.

**Good — names the surface, what is missing, and what a consumer experiences:**

> \`POST /reviews/:id/accept\` is deleted (\`routes.ts:88\`) and replaced by
> \`POST /findings/:id/accept\` in the same diff. No alias, no \`Sunset\` header,
> no window: any client still calling the old path gets a 404 the moment this
> deploys.

> \`ConventionCandidate.accepted\` is marked \`@deprecated\`
> (\`contracts/knowledge.ts:214\`) with no replacement named and no removal
> version. A reader learns the field is wrong but not what to read instead, and
> nothing schedules the cleanup.

> Migration \`0013\` adds \`status\` and drops \`accepted\` in one file
> (\`0013_conventions_extract.sql:21\`). Rolling back after deploy restores the
> column but not its values.

## Severity

- **CRITICAL** — a public surface is removed with no prior deprecation and no
  alias in this diff, or a migration drops a column in the same change that
  introduces its replacement.
- **WARNING** — a deprecation missing one of its four parts: no replacement
  named, no stated end, a duplicated body instead of a delegation, or a warning
  that fires per call.
- **SUGGESTION** — a marker whose wording does not say what to do, an end date
  long past with the code still present, a deprecation recorded only in a
  ticket.

Marking something deprecated is not a finding. Removing something that was
never public, or that was deprecated with a stated end that has passed, is not a
finding either — that is the policy working.`,
};


export const RESPONSE_SCHEMA: SeedSkill = {
  name: "response-schema",
  description:
    "Check every changed response against its declared schema \u2014 a field the handler sets but the schema omits is dropped on the wire, and required/optional/nullable are three different promises.",
  type: "convention",
  body: `# Response schema

A response has two definitions: the schema that declares it and the handler that
builds it. Each one looks correct on its own, and reviewers read them in
different files. The bug lives in the gap between them, and it is usually
silent — no exception, no failing test, just a field that never arrives.

This is narrower than \`breaking-change\`, which asks whether a published contract
may move at all. Here the question is mechanical: **does the response the
handler actually produces match the response it promises?**

## 1. Declared vs returned

Walk the handler's return object field by field against the declared response
schema, in both directions.

- **In the handler, not in the schema** → the field is dropped at
  serialization. The handler is provably doing work nobody receives, and no
  test that calls the service function instead of the route will catch it.
- **In the schema, not in the handler** → the client is promised a field that
  arrives \`undefined\`, or the response fails validation on the way out.
- **No response schema declared at all** → nothing is enforced and nothing is
  stripped; internal fields leak and the "contract" is whatever the handler
  happened to return today.

Check the mapper too, not just the route. A DTO function that spreads a DB row
(\`...row\`) sends every column the table has, including ones added later by a
migration nobody reviewed for exposure.

## 2. Required, optional, nullable — three different promises

These are not interchangeable, and picking the wrong one is the most common
defect in a response schema:

- \`z.string()\` — the field is always there and always a string.
- \`z.string().optional()\` — the key may be **absent**.
- \`z.string().nullable()\` — the key is **present** and may be \`null\`.
- \`z.string().nullish()\` — either. Usually a sign nobody decided.

A client written for one of these breaks on another. Ask what the handler can
actually produce: if any branch can leave it out, \`optional\` is the honest
declaration; if it computes an explicit "no value", \`nullable\` is.

**Bad — the schema promises more than the handler can deliver:**

\`\`\`ts
// schema
scan: ConventionScan,
// handler: a repo that was never scanned has no row
return { scan: latest ? toDto(latest) : undefined };
\`\`\`

**Good — the absence is part of the declared shape:**

\`\`\`ts
scan: ConventionScan.nullable(),
return { scan: latest ? toDto(latest) : null };
\`\`\`

## 3. Direction matters — widening a response is a break

On the way **in** (request), widening is safe: accepting \`string | null\` where
you accepted \`string\` accepts strictly more. On the way **out** (response), it
is the opposite — the client never had to handle the new case.

- ❌ breaking: response \`string\` → \`string | null\`; \`number\` → \`number | string\`;
  a required field made \`.optional()\`; an enum gaining a member a client
  switches on exhaustively.
- ✅ safe: response \`string | null\` → \`string\` (the client's null branch goes
  dead but still compiles); an **added** field; an optional field made required.

## 4. Things that quietly delete the contract

- \`z.any()\`, \`z.unknown()\`, \`z.record(z.unknown())\` in a response — a field with
  no shape is not a contract, it is a promise to break later.
- \`.passthrough()\` on a response object — undeclared keys stop being stripped,
  so the schema no longer describes what ships.
- \`.default()\` in a **response** schema — the client cannot tell "the server had
  no value" from "the value is genuinely zero/empty".
- A representation change with no type change: a timestamp moving from
  \`2026-09-21T04:15:59.294Z\` to a unix number, an id from \`number\` to \`string\`,
  a money field from cents to a decimal string. Every type still checks.

## 5. Consumers move in the same change

When the response contract lives in a shared package, the producer and every
consumer of that type must move together, and a type checker cannot see across
the serialization boundary. In a repo that vendors its contracts into more than
one package, changing one copy and not the other is the finding — both look
internally consistent, and they now disagree about the wire.

## 6. Report it

**Bad findings — no field, no mechanism, nothing to act on:**

> The response schema should be updated.

> Consider making this field optional.

**Good findings — name the field, the direction, and what the client sees:**

> \`ConventionsView.scan\` is declared non-nullable (\`contracts/knowledge.ts:271\`)
> but \`service.view\` returns \`undefined\` for a repo that was never scanned
> (\`service.ts:68\`). The route serializes it away, so the client receives an
> object with no \`scan\` key while its own type says the key is always present.

> \`toSkillDto\` spreads the row (\`helpers.ts:44\`), so the \`skills\` table's new
> \`internal_notes\` column now ships in every \`GET /skills\` response. The
> declared schema does not list it, so nothing stripped it either.

Say when you cannot see a consumer: "no reader of this field appears in this
diff" is honest. "This breaks the frontend" without pointing at the reader is a
guess.

## Severity

- **CRITICAL** — the handler and the declared schema disagree so that wrong or
  missing data ships, or an internal/sensitive field is exposed by an
  undeclared or spread response.
- **WARNING** — a response type widened, a required field made optional, a
  response schema left undeclared, \`any\`/\`unknown\`/\`passthrough\`/\`default\` used
  where a real shape belongs.
- **SUGGESTION** — representation consistency with the rest of the API: date
  format, id type, naming or casing of a new field.

A field **added** to a response is not a finding on its own. A schema that is
stricter than the handler needs is not a finding. "The shape could be cleaner",
with no field named and no client consequence, is not a finding at all.`,
};


export const SEMVER_DISCIPLINE: SeedSkill = {
  name: "semver-discipline",
  description:
    "Grade each release by its worst change \u2014 flag a diff whose version bump is smaller than the compatibility it breaks, and stay silent on packages nobody resolves a range against.",
  type: "convention",
  body: `# Semver discipline

A version number is not a label, it is an instruction to a resolver. \`^1.4.0\`
means "take anything up to 2.0.0 without asking me". Ship a breaking change as
\`1.4.1\` and every consumer upgrades into it automatically, at a moment nobody
chose, usually in CI.

The finding here is never "this change is breaking" on its own — that is
\`breaking-change\`'s job. It is the **mismatch**: what the diff does to
compatibility versus what the diff does to the version.

## 1. First: does anything resolve a range against this package?

If not, say nothing. A version on a package nobody installs by range is
decoration, and flagging it is pure noise.

Skip the package when its manifest says \`"private": true\`, when it sits at
\`0.0.0\` and has never been published, or when its consumers are path/workspace
references that always take the working copy. In that case a breaking change is
still a breaking change — report it as one, under its own rule — but do **not**
ask for a version bump that means nothing.

Apply this rule when the package is published to a registry, tagged for release,
or consumed by something that pins a range.

## 2. The arithmetic

Grade the release by its **worst** change, not its most common one:

- **MAJOR** — a correct consumer must change code or configuration to upgrade.
- **MINOR** — something was added; every existing consumer keeps working
  untouched.
- **PATCH** — neither: behaviour moves toward what was already documented.

One breaking change in a release of forty commits makes the whole release major.

## 3. \`0.x\` is not a free pass

\`^0.2.3\` resolves \`0.2.x\` only — in the \`0.y.z\` range, **minor carries the
weight of major**. A breaking change at \`0.2.4\` must ship as \`0.3.0\`, not
\`0.2.5\`; shipping it as a patch reaches every consumer silently, exactly like a
mis-graded major would after 1.0.

At \`0.0.z\` there is no compatible range at all, so consumers pin exact versions:
grade honestly, but do not expect the version to protect anyone.

## 4. Commonly mis-graded

**Major, though the diff looks small:**

- tightening validation that used to accept something — input that worked now 422s
- changing a default value, a timeout, a page size, a retry count
- removing or renaming an export, including one that was exported by accident
  but was reachable and documented by its presence
- narrowing a return type, or widening what a parameter demands
- raising the \`engines\` floor, or dropping a runtime version from the matrix
- removing a path from \`exports\` / \`files\`, or changing a subpath's meaning
- a dependency's major leaking through a re-exported type
- changing iteration or sort order that callers could observe

**Not major, though the diff looks big:**

- a large internal refactor with no change to the public surface
- adding an export, an optional parameter, a new overload, a new endpoint
- \`devDependencies\`, CI, docs, tests, lockfile churn
- performance work that preserves observable behaviour and ordering

## 5. What the finding looks like

**Bad — grades the change without checking the version, or vice versa:**

> This is a breaking change.

> The version was not bumped.

**Good — puts the two side by side and names who upgrades into it:**

> \`send(to, body)\` becomes \`send(opts)\` (\`client.ts:40\`) while \`package.json\`
> moves \`1.4.0\` → \`1.4.1\`. Every consumer on \`^1.4.0\` takes this on their next
> install without a code change of their own, and the call fails at runtime, not
> at compile time. This release is major.

> \`timeout\` defaults to \`5_000\` instead of \`30_000\` (\`config.ts:18\`) in a patch
> release. Consumers who never set it silently get a sixth of the budget; the
> only symptom is more timeouts under load.

> The diff raises \`engines.node\` from \`>=20\` to \`>=22\` (\`package.json:6\`) with
> no version change. Anyone on Node 20 installs a package that will not run.

Say when you cannot see the release process — "this repository may tag releases
outside the diff" is honest and worth writing once, not once per finding.

## Severity

- **CRITICAL** — a breaking change ships under a version bump that lets existing
  range-pinned consumers upgrade into it automatically (patch or minor after
  1.0; patch in \`0.x\`), or with no bump at all.
- **WARNING** — an additive change released as a patch, a bump larger than the
  change requires, a missing changelog entry where the repository keeps one, a
  runtime/engines change graded below major.
- **SUGGESTION** — release hygiene with no compatibility consequence: a version
  and a tag that disagree, an unreleased entry left open.

Do not ask for a bump on a package nobody resolves a range against. Do not grade
a change major because it is large. An internal rename the type checker catches
is not a release concern at all.`,
};

/** The skills the seed creates. `flake-patterns` arrives by import. */
export const SEED_SKILLS: readonly SeedSkill[] = [
  UNCOVERED_BRANCH_GATE,
  CORNER_CASE_CHECKLIST,
  OVER_MOCKING_GATE,
  API_CONTRACT_GATE,
  BREAKING_CHANGE,
  DEPRECATION_POLICY,
  RESPONSE_SCHEMA,
  SEMVER_DISCIPLINE,
];
