# Flow, or component test?

Every new UI behaviour raises the same question: does it get a `specs/*.flow.json`
here, or a `*.test.tsx` in `client/`? Getting it wrong is expensive in one
direction — a browser flow costs a whole seeded stack, runs for minutes in
`e2e-web.yml`, and fails for reasons that have nothing to do with the behaviour
it claims to test.

## The rule

**A flow proves a journey reaches a screen. A component test proves the screen
behaves.**

If you can state the thing you are testing without naming a route, it is a
component test.

| Test it here | Test it in `client/` |
|---|---|
| navigation between routes, and that the route renders at all | what a component renders given props |
| the seeded data actually arrives through the real API | conditional rendering, empty and error states |
| a tab or drawer opens and its content loads from the server | filtering, sorting, toggling, expanding |
| a regression that only appears with the whole stack wired | anything driven by local state |

## Worked example — findings by severity (L02)

That feature added four things. Only one of them was even a candidate for a flow,
and it did not get one:

- severity chips in the PR list's `Findings` column — *rendering given props* →
  `PRRow.test.tsx`
- a hover popover previewing findings — *hover state and a portal-free overlay* →
  `FindingsCell.test.tsx` with fake timers, which a browser flow cannot control
- severity chips on timeline tiles — *rendering given props* → `RunHistory.test.tsx`
- clickable severity pills that filter the findings list — *local state in one
  component* → `FindingsPanel.test.tsx`

The existing `04-pr-findings.flow.json` already proves the journey those live on:
app root → PR list → PR detail → Agent runs tab → a run accordion with its
verdict and findings. Adding a flow that clicks a pill would re-walk all of that
to assert something jsdom asserts in 300 ms.

Note that `04-pr-findings.flow.json` asserts on `"2 findings"` — the
`ReviewRunAccordion` **header**, not the new chips. That is the right level for a
flow: it checks the run rendered, not how its findings are laid out.

## When a UI change DOES need a flow change

Only when it moves the journey:

- a route path changes, or a tab's query param changes
- an element the flow finds by `role`/`text` is renamed or removed
- a new screen appears that no flow reaches

The last one is the only case that justifies a new file, and even then
`../CLAUDE.md` says to prefer extending an existing flow over adding a
near-duplicate.

## Before adding a flow, check the data

Flows run against a freshly seeded DB and assume `acme/payments-api` (PR #482) is
the first repo. A flow that needs data the seed does not create is a flow that
will fail in CI for a reason unrelated to its assertion — extend
`server/src/db/seed.ts` in the same change, or pick a different level of test.
