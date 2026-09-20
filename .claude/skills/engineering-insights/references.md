# References

Where the rules in [SKILL.md](SKILL.md) come from, and what was deliberately
changed for this repo.

## Contents

- Primary sources
- Authoring rules
- Deviations from the sources
- What is not built yet

---

## Primary sources

**MindStudio — Self-learning AI skill system with Learnings.md + wrap-up skill**
<https://www.mindstudio.ai/blog/self-learning-ai-skill-system-learnings-md-wrap-up>

The seven fixed sections come from here verbatim: What Works · What Doesn't Work ·
Codebase Patterns · Tool & Library Notes · Recurring Errors & Fixes ·
Session Notes · Open Questions. Also the source of:

- the quality bar — "every entry should be specific enough that an agent reading
  it cold knows exactly what to do";
- the vague-vs-useful pair quoted in [examples.md](examples.md) (`Promise.all()`
  timing out past 30 items);
- the failure modes listed in §7 — inconsistent capture, generic entries, file
  bloat, contradictory entries, and *"neglecting the What Doesn't Work section"*,
  which is why that section is checked first;
- cadence: run it after any session over ~30 minutes that contained a problem,
  a decision or a discovery; review periodically to prune what went stale.

**MindStudio — How to build a learnings loop for Claude Code skills**
<https://www.mindstudio.ai/blog/how-to-build-learnings-loop-claude-code-skills>

Source of the append-only rule in §5, quoted exactly: *"Do not overwrite existing
entries — only append, or correct with a dated note."* Also draws the line this
skill depends on — stable configuration belongs in `AGENTS.md`, evolving
discoveries belong in the insights file. "Project handbook" versus "sprint
retrospective notes."

Also the forced-active-reading trick, worth using by hand at the start of a
session in an unfamiliar package: *"confirm you've read INSIGHTS.md and summarize
the top 3 most relevant points for today's work."* Summarising forces processing;
loading the file does not.

**MindStudio — Compounding knowledge loop in Claude Code**
<https://www.mindstudio.ai/blog/compounding-knowledge-loop-claude-code>

Why a manual trigger is a known weakness rather than an oversight, and which hook
replaces it: `Stop`, at session end. Names the problem this skill exists to solve —
an agent that repeats itself and "makes the same class of mistakes as last week"
because institutional knowledge never leaves the operator's head.

**Anthropic — Skill authoring best practices**
<https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices>

**Anthropic — Lessons from building Claude Code: how we use skills**
<https://claude.com/blog/lessons-from-building-claude-code-how-we-use-skills>

Source of the structural decisions: a skill is a folder, not a file; a skill may
register hooks that live only while it is active — the intended shape for the
automatic trigger described below.

**dev.to — CLAUDE.md: building persistent memory for AI coding agents**
<https://dev.to/evoleinik/claudemd-building-persistent-memory-for-ai-coding-agents-5322>

Source of the Prisma Accelerate example in [examples.md](examples.md), and of the
boundary in §4: this is not a substitute for documentation, and not a workaround
for bad tooling. If the agent keeps forgetting how to run the tests, shorten the
test command instead of writing an entry about it.

---

## Authoring rules applied to this skill

From the Anthropic guide, and worth checking against on every edit:

- `description` states both **what** the skill does and **when** to use it, in
  third person — it is injected into the system prompt and is the only thing the
  model sees before deciding to load the skill.
- SKILL.md stays under 500 lines; detail lives in files linked one level deep,
  never nested deeper.
- Reference files over 100 lines open with a table of contents, so a partial read
  still shows the full scope.
- Forward slashes in every path, including on Windows.
- Concrete examples over abstract description — hence a whole file of entries
  rather than adjectives about good entries.

---

## Deviations from the sources

| Source says | This repo does | Why |
|---|---|---|
| File is `LEARNINGS.md` | `INSIGHTS.md` | The name predates this skill and the root `AGENTS.md` already routes non-obvious facts there. Two names for one thing breaks "one fact, one home". |
| One file at the repo root | One per package, plus a root file for cross-package facts | Knowledge lives next to the code it describes, and a session in `client/` should not page in `server/` lessons. |
| Free-form entries under each section | Fixed `Symptom / Cause / Rule / Where` shape | The shape is already established in this repo, and each field forces a piece of the cold-reader bar: `Where:` makes the entry verifiable, `Rule:` makes it actionable. |
| Sections only | Sections plus an explicit first-match-wins order | The seven sections overlap heavily — a silent `db:migrate` fits under three of them. Without a tie-break the same class of fact scatters, and nothing is findable. |

---

## What is not built yet

The capture step depends on someone invoking it. That is the known gap, stated
plainly in §6 rather than papered over.

The fix is a `Stop` hook that fires at session end, which Claude Code supports as
a `hooks` field in skill frontmatter — a hook scoped to the skill rather than
registered globally. Until that exists here, treat `/engineering-insights` as a
manual step at the end of a task.
