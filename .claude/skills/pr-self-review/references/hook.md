# The `gh pr create` guard

"Run before every PR" cannot be a rule inside a skill — a session that never
loads the skill never reads the rule. It has to be a hook, and the hook has to be
**global to the project**, not scoped to the skill.

That is the standing open question in the root `INSIGHTS.md` (2026-09-15,
scoped-vs-global hooks) answered for this case: global, because the session that
opens a PR is exactly the session that may never have loaded the skill.

## What is installed

`.claude/settings.json` (created by this skill; it did not exist before):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "if": "Bash(gh pr create*)",
            "command": "node .claude/skills/pr-self-review/scripts/pr-guard.mjs",
            "timeout": 20,
            "statusMessage": "Перевіряю self-review перед PR…"
          }
        ]
      }
    ]
  }
}
```

`if` keeps the hook from spawning node on every Bash call; the script re-checks
the command anyway, so the filter is an optimisation, not the guarantee.

## Division of labour

**The hook reviews nothing.** It reads
`.devdigest/cache/pr-self-review/last-run.json` and answers one question: is
there a fresh verdict, and did it pass?

| State | Result |
|---|---|
| no report | deny — "never reviewed" |
| `head_sha` ≠ current HEAD | deny — reviewed, then committed |
| `diff_hash` ≠ recomputed | deny — reviewed, then edited the tree |
| `blocked: true` | deny, listing every CRITICAL with `file:line` |
| fresh and clean | silent, exit 0, `gh pr create` proceeds |

A denial returns

```json
{"hookSpecificOutput":{"hookEventName":"PreToolUse",
 "permissionDecision":"deny","permissionDecisionReason":"…"}}
```

so the reason reaches the agent, which can then run `/pr-self-review`, fix, and
retry. Splitting it this way is what makes "do not merge this" an actual refusal
rather than a sentence in a prompt.

## What the guard matches

It sees the **raw command text**, so the pattern is anchored to the start of a
command — beginning of line, or after `;`, `&&`, `||`, `|`, `(`:

```
(^|[;&|(]|\n) \s* (VAR=val …)* (sudo )? gh pr create
```

A bare `/\bgh pr create\b/` also matches the string inside
`echo "runs gh pr create"`, and then the guard refuses a command that opens
nothing. It cost a blocked command while this skill was being written, so the
anchor is not decoration. It remains possible to trip it with a literal
`; gh pr create` inside a quoted string — that is the accepted residue.

## Bypass

```sh
PR_SELF_REVIEW_SKIP=1 gh pr create …
```

Read from the **command string**, not only from the hook's own environment: an
inline `VAR=1 cmd` prefix is applied by the shell when the command runs, which is
after the hook has already decided. A guard that only checked `process.env` would
document a bypass that never worked.

One call, no report written. For a deliberate, recorded bypass use
`/pr-self-review --override "<reason>"` instead — that one ends up in the PR
body, where a human can see it.

## Testing it without opening a PR

The hook reads its payload on stdin, so pipe one in:

```sh
# should print nothing, exit 0
echo '{"tool_input":{"command":"git status"}}' | node .claude/skills/pr-self-review/scripts/pr-guard.mjs

# should print a deny with a reason
echo '{"tool_input":{"command":"gh pr create --fill"}}' | node .claude/skills/pr-self-review/scripts/pr-guard.mjs
```

All four states above were verified this way when the guard was written.

## If the hook does not fire

The settings watcher only watches directories that already had a settings file
when the session started — and this repo had none until now. Open `/hooks` once
(that reloads the config) or restart the session. `/hooks` is also where the hook
can be reviewed, edited or disabled later.

## Windows

The command runs through Git Bash when it is present, PowerShell otherwise, so it
is written as a bare `node …` invocation with a forward-slash relative path,
which both accept. The script itself uses Node builtins only — no install step,
nothing to break before the repo's dependencies exist.

## Not chosen, and why

| Alternative | Why not |
|---|---|
| git `pre-push` in `.githooks/` + `core.hooksPath` | versioned and shell-only — it can print a reminder, but it cannot run an LLM review, and it fires on every push, not on PR creation |
| GitHub Actions | too late by definition: the PR is already open |
| A rule in `AGENTS.md` | advisory; the session that skips reading it is the one that needed it |
