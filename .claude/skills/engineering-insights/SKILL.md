---
name: engineering-insights
description: "Captures durable engineering lessons into the INSIGHTS.md of the package the work touched. Use at the end of any substantive task, and mid-task the moment something non-obvious surfaces — an approach that failed, a silent failure, a dependency quirk, a convention found only by reading code, or a decision worth its reasoning. Also invoked directly as /engineering-insights."
---

# Engineering Insights

Append what this session learned to the right `INSIGHTS.md`, so the next session
starts where this one ended instead of rediscovering the same thing.

The bar is a cold reader: an agent with no memory of this session reads the entry
and knows what to do. Anything short of that is noise.

See [examples.md](examples.md) for entries that pass and fail that bar.
See [references.md](references.md) for where these rules come from.

---

## 1. Pick the file

One file per package, next to the code it describes:

| The work touched | Write to |
|---|---|
| `server/` (including `src/modules/repo-intel`) | `server/INSIGHTS.md` |
| `client/` | `client/INSIGHTS.md` |
| `reviewer-core/` | `reviewer-core/INSIGHTS.md` |
| `e2e/` | `e2e/INSIGHTS.md` |
| two or more packages, or the repo itself (tooling, git, CI, `scripts/`) | `INSIGHTS.md` at the root |

Touched several packages with one lesson each? Write one entry per file. Never
duplicate the same entry into two files — link instead: `See ../INSIGHTS.md`.

## 2. Pick the section

Every `INSIGHTS.md` carries the same seven sections. They overlap, so resolve by
**first match wins**, checking in this order:

1. **What Doesn't Work** — an approach that was tried and failed, or an
   antipattern to avoid. *This section is the most valuable and the most often
   skipped. Check it first, every time.*
2. **Recurring Errors & Fixes** — a concrete symptom or error message seen more
   than once, plus the fix that ends it.
3. **Tool & Library Notes** — behaviour of a third-party dependency or external
   tool: version quirks, undocumented limits, platform differences.
4. **Codebase Patterns** — a convention, structure or architectural decision of
   *this* repo, including the reasoning behind it.
5. **What Works** — an approach that succeeded and should be repeated.
6. **Open Questions** — something that stayed unresolved. A question you cannot
   answer is worth recording; a question you did answer belongs above.
7. **Session Notes** — one dated line summarising the session, written last.

## 3. Write the entry

Sections are `##`. Entries inside them are `###`, newest first:

```markdown
### YYYY-MM-DD — one-line title, specific enough to grep
**Symptom:** what you actually saw.
**Cause:** why it happens.
**Rule:** what to do from now on.
**Where:** `path/to/file.ts:42`
```

`Session Notes` and `Open Questions` are the exceptions — both take plain dated
bullets, no four-field shape.

Rules for the text:

- **Name real things.** File paths, function names, flags, version numbers, exact
  error strings. `Where:` is mandatory, must point at something that exists, and
  carries a **line number**: `path/to/file.ts:42`, not a bare path. A reader
  should land on the code, not go hunting through it. Point at the line the
  lesson is actually about — the function signature, the config key, the
  offending expression — and name the symbol in parentheses when the line is
  likely to drift: `` `server/src/app.ts:41` (`buildApp`) ``. A lesson about a
  whole folder still cites one representative file and line. The rare entry with
  no single home (a repo-wide tooling quirk) says so and still cites the files
  where it bit.
- **`Rule:` is an instruction, not an observation.** "Run X before Y", not
  "X and Y interact badly".
- **State the reasoning when the fact looks arbitrary.** A rule without a why
  gets "fixed" by the next person.
- **Present tense, no narrative.** Nobody needs the story of how you found it.

## 4. Apply the quality bar

> If it would be obvious to anyone reading the code, don't write it.

Delete the draft entry if any of these is true:

- It restates the language, framework or a public API (`useEffect runs after render`).
- It has no `Where:`, has one without a line number, or points at a file you
  did not open.
- It could be pasted into an unrelated repo unchanged — that means it says nothing
  about *this* codebase.
- It is a task log (`added the endpoint`) rather than a lesson.
- It is already in this file, or in `<pkg>/CLAUDE.md`, `<pkg>/README.md` or
  `<pkg>/docs/`. Those homes win; `INSIGHTS.md` is for what has no home yet.

Zero entries is a valid outcome. Say so and stop — a padded file costs the next
session more than an empty one.

## 5. Append, never overwrite

- **Add entries. Do not edit or delete existing ones.** Concurrent sessions and
  branches both write here; overwriting loses other people's lessons and produces
  merge conflicts that get resolved by discarding knowledge.
- **An entry proven wrong gets a correction, not a deletion.** Append a dated line
  to it: `**Correction (YYYY-MM-DD):** superseded — pgvector 0.8 removed the limit.`
  The history of a wrong belief is itself a lesson.
- **Contradicting an existing entry is a stop condition.** Do not add the opposite
  claim silently — an agent reading two contradictory rules picks one at random.
  Correct the old entry and say in your reply that you did.

## 6. When to run

Two triggers, both required:

- **As you go.** The moment something non-obvious costs you time, write it. Do not
  wait for the end of the task — that is where lessons get lost.
- **At the end of a task.** Sweep the session for anything not yet captured.

Skip it when the session taught nothing worth a cold reader's time: config tweaks,
renames, a task that went exactly as expected. Signal quality decides, not volume.

Honest limitation for now: this runs on the skill description and on
`/engineering-insights`. Model-driven triggering is not reliable — if it matters
that a session gets captured, invoke it by hand.

## 7. Keep the file from rotting

Flag these in your reply when you notice them; do not act on them unasked:

- **Stale entries.** A dependency upgrade turns a quirk note into bad advice.
- **File over ~200 entries.** Signal-to-noise collapses. Split by domain
  (`INSIGHTS-auth.md`) or prune.
- **Duplicates.** Two entries for one fact means neither gets trusted.

`INSIGHTS.md` is a reviewed draft, not scripture. It is committed to git so a bad
capture can be read in a diff and reverted.

## Checklist

```
- [ ] Right file for the package(s) touched
- [ ] Section chosen by the first-match-wins order (What Doesn't Work checked first)
- [ ] Every entry has Symptom / Cause / Rule / Where
- [ ] Where: points at a path that exists, WITH a line number
- [ ] Passes the cold-reader bar; banal entries dropped
- [ ] Appended only — nothing existing edited or deleted
- [ ] No contradiction with an entry already in the file
- [ ] One dated line added to Session Notes
```
