# Examples

Before/after pairs for `frontend-ui-architecture`, using the shapes and names
that actually appear in `client/src`. Each one is a placement mistake, not a
syntax mistake — the "before" compiles and works.

## 1. A page that computes

The page is the composition layer. When it starts deriving, the logic has no
test and no home.

```tsx
// ✗ src/app/repos/[repoId]/pulls/[number]/page.tsx
export default function PrDetailPage() {
  const { data: findings = [] } = usePrFindings(repoId, number);
  const [hideLow, setHideLow] = useState(false);

  const shown = [...(hideLow ? findings.filter((f) => f.confidence >= 0.65) : findings)]
    .sort((a, b) => WEIGHTS[a.severity] - WEIGHTS[b.severity]);

  return <FindingsPanel findings={shown} onToggle={setHideLow} />;
}
```

```tsx
// ✓ page.tsx — composes and passes props
export default function PrDetailPage() {
  const { data: findings = [], isLoading, error } = usePrFindings(repoId, number);

  if (isLoading) return <PrDetailSkeleton />;
  if (error) return <PrDetailError error={error} />;

  return <FindingsPanel findings={findings} />;
}
```

```ts
// ✓ _components/FindingsPanel/constants.ts — the threshold has a name and a reason
/** Confidence below this is hidden when "hide low confidence" is on. */
export const LOW_CONFIDENCE_THRESHOLD = 0.65;

/** Sort weight per severity (lower = shown first). */
export const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0, WARNING: 1, SUGGESTION: 2, INFO: 3,
};
```

```ts
// ✓ _components/FindingsPanel/helpers.ts — pure, testable without React
import type { FindingRecord } from "@devdigest/shared";
import { LOW_CONFIDENCE_THRESHOLD, SEVERITY_ORDER } from "./constants";

export function visibleFindings(findings: FindingRecord[], hideLow: boolean) {
  const shown = hideLow
    ? findings.filter((f) => f.confidence >= LOW_CONFIDENCE_THRESHOLD)
    : findings;
  return [...shown].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );
}
```

The panel owns `hideLow` — the state lives with the toggle that changes it —
and calls `visibleFindings` during render.

## 2. `fetch` in a component

```tsx
// ✗ the endpoint has no hook, so the component grew one inline
function AgentsListView() {
  const [agents, setAgents] = useState<Agent[]>([]);
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_BASE}/agents`)
      .then((r) => r.json())
      .then(setAgents);
  }, []);
  // no error state, no cache, no invalidation, and a second copy of the base URL
}
```

```ts
// ✓ src/lib/hooks/agents.ts — the query key and its invalidations in one place
export function useAgents() {
  return useQuery({ queryKey: ["agents"], queryFn: () => api.get<Agent[]>("/agents") });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AgentCreate) => api.post<Agent>("/agents", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });
}
```

```tsx
// ✓ the component just consumes it
function AgentsListView() {
  const { data: agents = [], isLoading, error } = useAgents();
  // ...
}
```

Going through `api.ts` also means failures arrive as `ApiError` with a status,
which is what the toast / inline / full-screen error taxonomy branches on.

## 3. Deriving vs. storing

```tsx
// ✗ two sources of truth, kept in sync by hand
const [findings, setFindings] = useState<FindingRecord[]>([]);
const [criticalCount, setCriticalCount] = useState(0);

useEffect(() => {
  setCriticalCount(findings.filter((f) => f.severity === "CRITICAL").length);
}, [findings]);
```

```tsx
// ✓ one source of truth; the count cannot drift
const criticalCount = findings.filter((f) => f.severity === "CRITICAL").length;
```

If the derivation is more than a line, it is a `helpers.ts` function. If it is
genuinely expensive — measured, not assumed — that is when `useMemo` enters, and
`react-best-practices` covers the trade-off.

## 4. Deep import past `index.ts`

```ts
// ✗ reaches into another component's internals; now the folder cannot move
import { SEVERITY_ORDER } from "../FindingsPanel/constants";
```

Two legitimate outcomes, depending on what is true:

```ts
// ✓ if the value is genuinely shared — promote it
// src/lib/finding-format.ts
export const SEVERITY_ORDER: Record<string, number> = { /* ... */ };
```

```ts
// ✓ if only the rendered result is needed — export that from index.ts
import { FindingsPanel } from "@/app/.../\_components/FindingsPanel";
```

What is *not* an outcome: adding the deep path to an allowlist. The import is
the symptom; the placement is the bug.

## 5. A component a second route needs

```
✗ src/app/repos/[repoId]/pulls/[number]/_components/RunCostBadge/   ← used by /repos
  src/app/agents/_components/RunCostBadge/                          ← copy-pasted
```

```
✓ src/components/run-cost-badge/
    RunCostBadge.tsx
    RunCostBadge.test.tsx
    constants.ts
    index.ts
```

Folder becomes kebab-case because it is now a shared module; the component file
stays `RunCostBadge.tsx`. Move it in one commit and update both call sites — a
copy "just for now" is how two badges drift apart over a month.

## 6. Generic bucket vs. subject-named module

```ts
// ✗ src/lib/utils.ts — tells you the shape, never the owner
export function formatCost(cents: number) {}
export function prUrl(repo: string, n: number) {}
export function modelLabel(id: string) {}
```

```ts
// ✓ one subject per file, guessable from the name
// src/lib/format-cost.ts, src/lib/github-urls.ts, src/lib/model-label.ts
```

A `utils.ts` has no natural stopping point: nothing ever fails to belong in it,
so it grows until it is a dependency of everything and owned by no one.

## 7. `'use client'` placed too high

```tsx
// ✗ the whole subtree ships to the browser for one popover
"use client";

export default function SettingsLayout({ children }) {
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <section>
      <StaticHeading />   {/* static, but now client-side */}
      <HelpPopover open={helpOpen} onOpenChange={setHelpOpen} />
      {children}
    </section>
  );
}
```

```tsx
// ✓ the layout stays a server component; only the popover is a client one
export default function SettingsLayout({ children }) {
  return (
    <section>
      <StaticHeading />
      <HelpPopover />      {/* "use client" lives in HelpPopover */}
      {children}
    </section>
  );
}
```

Read this as guidance for **new** code. Existing pages in `client/` carry the
directive at the top by design — the app is a SPA over the Fastify API — so
narrowing an existing boundary is a deliberate refactor to propose, not a
drive-by edit.

## 8. Where a type belongs

```ts
// ✗ a types/ folder that collects everything by shape
// src/types/index.ts
export interface FindingsPanelProps { /* used in exactly one file */ }
```

```tsx
// ✓ single-use type stays with its only consumer
// _components/FindingsPanel/FindingsPanel.tsx
type FindingsPanelProps = { findings: FindingRecord[] };
```

```ts
// ✓ client-wide type
// src/lib/types.ts
export type ConnTestProvider = "openai" | "anthropic" | "google";
```

```ts
// ✓ a shape the server must agree on — a Zod schema in the shared contract,
// with the type inferred from it. Cross-package change: read ../AGENTS.md first,
// and never hand-edit src/vendor/shared to make the client compile.
export const FindingRecord = z.object({ /* ... */ });
export type FindingRecord = z.infer<typeof FindingRecord>;
```
