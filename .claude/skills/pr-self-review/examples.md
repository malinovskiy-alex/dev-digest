# Examples

Three runs: one that blocks, one that does not, and one that must not.

---

## 1. Blocking — a real CRITICAL

**Diff:** `server/src/modules/pulls/routes.ts`, `server/src/db/schema.ts`,
`client/src/app/repos/[repoId]/pulls/[number]/page.tsx`.

**Routing:** backend (`fastify-best-practices`, `onion-architecture`, `security`,
`perf-prompt`, `postgresql-table-design`, `drizzle-orm-patterns`) + frontend
(`frontend-ui-architecture`, `react-best-practices`, `next-best-practices`).

Gates first — and they already decide the outcome:

```
[CRITICAL] G9 server/src/db/schema.ts — Схему змінено без міграції
```

The lens pass adds a second one, grounded in a real hunk:

```jsonc
{
  "severity": "CRITICAL", "category": "security", "confidence": 0.86, "grounded": true,
  "file": "server/src/modules/pulls/routes.ts", "start_line": 238, "end_line": 240,
  "title": "Запит без workspace_id",
  "rationale": "Хендлер читає pulls напряму через db.select, без скоупу workspace_id — PR іншого воркспейса віддається на запит. Скоупинг живе в репозиторії (RepoRepository), і маршрут його обходить.",
  "lens": "onion-architecture"
}
```

**Terminal:**

```
✗ request_changes — 2 CRITICAL · 3 WARNING · 5 SUGGESTION
CRITICAL
  server/src/db/schema.ts — схему змінено без міграції                      [gate G9]
  server/src/modules/pulls/routes.ts:238 — запит без workspace_id           [onion-architecture]
WARNING
  client/src/app/…/page.tsx:64 — fetch у компоненті замість хука            [frontend-ui-architecture]
  …
gates: G1-G12 1 fail · typecheck pass · arch pass · tests baseline
повний звіт: .devdigest/cache/pr-self-review/last-run.json
```

`gh pr create` now fails at the guard with both CRITICALs quoted. Correct: one is
a database that does not match the code, the other leaks another workspace's
data — both are the `general-reviewer.md` bar for CRITICAL.

---

## 2. Not blocking — noise stays noise

**Diff:** `client/src/components/run-cost-badge/` (new component folder),
`client/src/lib/hooks/reviews.ts`.

Findings: a `useMemo` that buys nothing (`react-best-practices`, MEDIUM →
SUGGESTION), a constant that belongs in `constants.ts`
(`frontend-ui-architecture` → SUGGESTION), a hardcoded string caught by G12
(WARNING), a missing colocated test (WARNING, G11's soft half).

```
✓ comment — 0 CRITICAL · 2 WARNING · 3 SUGGESTION
WARNING
  client/src/components/run-cost-badge/RunCostBadge.tsx:18 — текст повз next-intl   [gate G12]
  client/src/lib/hooks/reviews.ts:12 — новий хук без тесту в client-сюїті           [gate G11]
повний звіт: .devdigest/cache/pr-self-review/last-run.json
```

`blocked: false`, the PR opens. Nothing here can take production down, so nothing
here is CRITICAL — and the three SUGGESTIONs never reach the terminal.

**The mistake to avoid:** promoting "the badge should be shared, not route-local"
to CRITICAL because `frontend-ui-architecture` feels strongly about it.
`general-reviewer.md:62` is explicit — placement preference is a WARNING at most.

---

## 3. Must not block — the false positive

A lens reports:

```
CRITICAL · security · server/src/adapters/github/index.ts
"Схоже, десь у цьому файлі токен потрапляє в лог."
```

Three separate reasons this never blocks:

1. **Ungrounded.** No `start_line`/`end_line` inside a hunk of this diff. The
   same rule `reviewer-core`'s grounding gate applies to model output applies
   here → demoted to WARNING.
2. **Confidence.** "Схоже" is not "pattern + confirmed attacker-controlled
   input". Under the `security` skill's own model that is MEDIUM → WARNING, not
   a blocker.
3. **Scope.** If the line it means is not in the diff at all, it is pre-existing
   code. This skill reviews what is open, not the repository.

Recorded as `{"severity":"WARNING","grounded":false,"confidence":0.4}` and
counted, not hidden — but `blocked` stays `false`.

---

## 4. Gate-only, no model at all

**Diff:** one file — `server/src/vendor/shared/contracts/findings.ts`.

```
✗ request_changes — 1 CRITICAL
CRITICAL
  server/src/vendor/shared/contracts/findings.ts — вендорена копія розійшлася   [gate G1]
```

`client/src/vendor/shared/contracts/findings.ts` was not mirrored, so request
validation and the client's types now disagree. Found by content comparison in
`gates.mjs`, in milliseconds, with no lens running.

The same shape catches an unregistered module:

```
[CRITICAL] G8 server/src/modules/webhooks/routes.ts — Модуль webhooks не зареєстрований
```

The route exists, the app never serves it. Verified against
`server/src/modules/index.ts`, not guessed.

---

## 5. The second run

After fixing both CRITICALs from example 1:

```
✓ comment — 0 CRITICAL · 3 WARNING · 5 SUGGESTION   (2 виправлено, 0 нових)
```

Only the two touched hunks were re-reviewed; the untouched frontend slice came
from cache. The `delta` line is what tells the author the fix landed — and
CRITICALs were re-checked from scratch anyway, because a cached "fixed" CRITICAL
is a bug shipped in silence.
