---
name: workflow-retro
description: "Retrospective of a multi-agent workflow that just ran in this session — /run-plan, spec-creator → implementation-planner, a review loop, any chain of subagents. Collects the hard numbers from the session transcripts (tokens per agent, cache hit, launch order, parallelism, tool calls and errors, files read by several agents) with a script, then judges the run: what each agent found hard, what went easily, which information was duplicated, what was missed, and what to change in the agent definitions or the workflow. Use when a multi-agent workflow finishes, when the user asks how a run went or what it cost, or as /workflow-retro. Writes one report — `specs/<slug>.retro.md` when the workflow built a spec'd feature, else .devdigest/cache/retro/; proposes, never applies, changes to agents."
argument-hint: "[spec slug | workflow name] [session-id | latest]"
---

# /workflow-retro — how did the workflow go

Two halves. The **numbers** come from a script and are never estimated by hand.
The **judgement** is yours, and every claim in it cites evidence: an agent's
report, a tool error, a user correction, a file. A retro without evidence is an
opinion; skip the line instead.

## 1. Collect the numbers

```sh
node .claude/skills/workflow-retro/scripts/session-stats.mjs --session ${CLAUDE_SESSION_ID}
```

- A session id in `$ARGUMENTS` overrides `${CLAUDE_SESSION_ID}`; `latest` takes the
  most recently modified transcript.
- The workflow spans a `/clear`? Run it once per session id and add the totals.
- `--json` gives the raw structure if you need a number the table does not show.

The script reads `~/.claude/projects/<project>/<session>.jsonl` and
`<session>/subagents/agent-*.jsonl` (+ `.meta.json`). It prints totals, a table per
agent, the timeline, tool calls, tool errors, files read by more than one agent
and files written. It never prints transcript text, so it is safe for context.

**Read the numbers right:**

| Column | Means | Watch for |
|---|---|---|
| Input | all input tokens incl. cache reads — every request re-sends the whole context | grows with context size × requests, not with work done |
| Cache hit | cache read / input | < 70% on a long agent: context churn, or a model/effort switch mid-run |
| Requests | API round-trips | many requests with few writes = searching, not doing |
| Active | wall time minus gaps > 5 min | waiting for the user is not agent time |
| Follow-ups | prompts the agent got after its first one | each one is a hand-over that its first prompt did not cover |
| Tool errors | `is_error` tool results, incl. permission denials | the same error twice = a missing rule |

Session token totals are what the transcripts record; they do not include what
the harness spent outside the model (hooks, MCP servers). Say so if asked for cost
— do not convert tokens to money from memory.

## 2. Judge the run

Sources, in this order — do not re-read code the agents wrote:

1. this conversation: the prompts you sent, the agents' final reports, what the
   user corrected afterwards;
2. the script output;
3. the files the workflow produced (spec, plan, `.devdigest/cache/sdd/<slug>/findings.md`
   and `state.md` for `/run-plan`).

For **each agent**, answer:

- **Hard** — tool errors, missing tools it asked for (e.g. no `AskUserQuestion` in
  a background run), follow-ups it needed, things it reported it could not do.
- **Easy** — what it finished in its first pass with no correction.
- **Duplicated** — files read by several agents (the script lists them), facts the
  coordinator retold in a prompt instead of passing a path, the same question asked
  twice.
- **Missed** — what the user or a later agent had to correct: a wrong language,
  a requirement the user added afterwards, a stray file, a finding a reviewer
  raised that the writer should have caught.

For the **workflow as a whole**:

- Order and parallelism — did read-only agents run in parallel, did a writer wait
  on something it did not need?
- Hand-overs — did every agent get paths, or retold summaries?
- Where the tokens went — the most expensive agent, and whether its cost bought
  output (writes, findings) or only context.
- Questions to the user — how many, and how many could the spec or the agent
  definition have answered.

## 3. Write the report

| The workflow | File |
|---|---|
| built a feature with a spec (`/run-plan`, spec-creator → implementation-planner) | `<specs-dir>/<slug>.retro.md`, next to the plan — committed with the feature |
| anything else | `.devdigest/cache/retro/<YYYY-MM-DD>-<workflow-slug>.md` (gitignored) |

Written in English, like everything in `specs/`; talk to the user in their language.

```markdown
# Retro — <workflow> · <date>
Session(s) `<id>` · Branch `<branch>`

## Numbers
<the script's totals line and agent table, verbatim>

## Timeline
<the script's timeline, plus one line per user decision point>

## Per agent
### <agent type>
- Hard: … (evidence)
- Easy: …
- Duplicated: …
- Missed: …

## Workflow
<order, hand-overs, where the tokens went, questions to the user>

## Recommendations
| # | Change | Where | Expected effect | Evidence |
|---|---|---|---|---|
| 1 | … | `.claude/agents/<name>.md` § … | … | … |
```

Then tell the user, in their language: the totals line, the three most useful
recommendations, and the report path.

## Rules

- **Propose, never apply.** A recommendation that edits `.claude/agents/*`, a skill
  or `AGENTS.md` is applied only after the user picks it — ask once, multiSelect.
- A lesson about the **code** (a trap, a quirk) goes to `/engineering-insights`, not
  here. This skill is about how the agents and the workflow behaved.
- Numbers come only from the script. If the script fails, report the failure; do
  not estimate.
- Never paste transcript content into the report beyond a short quote that is the
  evidence for a claim.
