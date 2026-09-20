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

/** The four skills the seed creates. `flake-patterns` arrives by import. */
export const SEED_SKILLS: readonly SeedSkill[] = [
  UNCOVERED_BRANCH_GATE,
  CORNER_CASE_CHECKLIST,
  OVER_MOCKING_GATE,
  API_CONTRACT_GATE,
];
