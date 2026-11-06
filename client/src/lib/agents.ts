import type { Agent } from "@devdigest/shared";

/**
 * Case-insensitive filter over an agent's name + description. Shared by the
 * agents grid (`/agents`) and the editor's left-hand list (`/agents/:id`), which
 * must narrow the same way — a search that means two different things on two
 * screens is worse than no search.
 */
export function filterAgents(agents: Agent[], search: string): Agent[] {
  const q = search.trim().toLowerCase();
  if (!q) return agents;
  return agents.filter((a) => `${a.name} ${a.description}`.toLowerCase().includes(q));
}

/**
 * The agent editor's address for `agentId` on `tab`, keeping every other key of
 * the current address — the Stats tab's `range`/`start`/`end`/`at` among them —
 * so switching tab or switching agent keeps the applied range (L08 R-84, F-13).
 */
export function agentEditorHref(agentId: string, tab: string, current: { toString(): string }): string {
  const sp = new URLSearchParams(current.toString());
  sp.set("tab", tab);
  return `/agents/${encodeURIComponent(agentId)}?${sp.toString()}`;
}
