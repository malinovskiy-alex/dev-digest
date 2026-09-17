# `@devdigest/e2e` — agent instructions

Deterministic browser flows for the web app, driven by Vercel **agent-browser**
(native CDP CLI). **No Playwright, no LLM, no API key.**

## Read before you act

These are **not** loaded for you. Read the file when its trigger matches.

| Read | When |
|---|---|
| [README.md](README.md) | before you change anything here — how a flow works, the command conventions, and how to run against your own stack |
| [docs/](docs/README.md) | you need the reasoning behind the setup, beyond what the code shows |
| [specs/](specs/README.md) | you are adding a flow — it holds both the `.flow.json` flows and their `.md` plans |
| [INSIGHTS.md](INSIGHTS.md) | a flow fails for no visible reason — check here **before** you start debugging |
| [../TESTING.md](../TESTING.md) | you are unsure whether a behaviour belongs here or in a component test |
| [../CLAUDE.md](../CLAUDE.md) | your change crosses a package boundary |

## Commands

```sh
pnpm test            # runs every specs/*.flow.json against E2E_BASE_URL
pnpm e2e:hermetic    # ../scripts/e2e.sh — brings up its own stack
pnpm typecheck
```

## Conventions

- **Deterministic locators only:** `wait --url`, `wait --text`,
  `find role|text|label`. The AI `chat` command is **banned** — it makes runs
  non-reproducible and needs a key.
- **No model calls.** Flows exercise read-only seeded data (the demo repo
  `acme/payments-api`, PR #482, the seeded agents). A flow must never press
  anything that triggers a review run.
- **`wait` *is* the assertion** — it exits non-zero on timeout, which fails the
  step and the flow. Add an `assert` with `stdoutIncludes` only when you need an
  extra substring check on top of that.
- **A flow is data, not code.** Flows run in order against one shared browser
  session. Keep every step labelled — the label is what a failing CI log shows.
- **Preconditions matter.** Flow `02` follows the home redirect to the *first*
  repo, so the suite assumes a freshly seeded DB holding only the demo repo. CI
  guarantees that; locally, reseed before blaming a failure.
- Prefer extending an existing flow over adding a near-duplicate. The suite is a
  smoke net, not exhaustive coverage — component-level behaviour belongs in
  [`../client`](../client/CLAUDE.md) tests.

## Naming

- **A flow is `specs/NN-name.flow.json`** — two digits, zero-padded, kebab-case
  name: `02-repo-pulls-detail.flow.json`. The number is the run order, so a new
  flow takes the next free one rather than squeezing between two existing flows.
- **A plan is `specs/*.md`**, alongside the flows it describes.
- **Step labels are prose, not ids.** They are the only thing a failing CI log
  shows, so write what the step is doing.

## Where things live

- runner (spec discovery, `{BASE}` substitution, ordering) → `run.ts`
- flows → `specs/*.flow.json`
- helpers → `lib/`
- browser config → `agent-browser.json`
- hermetic stack script → `../scripts/e2e.sh`

## Gotchas

- `specs/` holds **both** `.flow.json` flows and `.md` plans. The runner filters
  on `.flow.json` (`run.ts:54`), so markdown there is inert and safe.
