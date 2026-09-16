# e2e/specs/

This folder holds **two kinds of file**:

- `NN-name.flow.json` — the executable flows. `run.ts` discovers them by the
  `.flow.json` suffix and runs them in filename order against one shared browser
  session.
- `*.md` — plans for flows not written yet. Inert to the runner (it filters on
  the suffix), so they live here next to what they describe.

## Existing flows

`01-app-boot` · `02-repo-pulls-detail` · `03-agents` · `04-pr-findings` ·
`05-pr-diff` · `06-onboarding` · `07-settings`

## Planning a flow

1. **Journey** — the user-visible path, in plain sentences.
2. **Seed dependency** — which seeded rows it needs, and whether it assumes the
   demo repo is the only one.
3. **Steps** — each as a labelled agent-browser command with a deterministic
   locator (`wait --url`, `wait --text`, `find role|text|label`).
4. **Cost check** — confirm no step triggers a review run or any other model
   call. If it would, it is not an e2e flow.
5. **Numbering** — new flows take the next free `NN`; order matters, since the
   session is shared.
