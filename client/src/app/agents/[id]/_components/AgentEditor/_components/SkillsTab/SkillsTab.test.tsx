import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Agent, AgentSkillLink, Skill } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/agents.json";
// SkillRow renders the type badge from the `skills` namespace. Without it
// next-intl logs MISSING_MESSAGE and renders the raw key — the suite stays
// green over a component that is rendering wrongly.
import skills from "../../../../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";

const AGENT: Agent = {
  id: "ag1",
  name: "Test Quality Reviewer",
  description: "Reviews the tests in a diff",
  provider: "openrouter",
  model: "deepseek-v4-flash",
  system_prompt: "You review tests.",
  output_schema: null,
  strategy: "single-pass",
  ci_fail_on: "critical",
  repo_intel: true,
  enabled: true,
  version: 3,
  skill_count: 2,
};

function skill(id: string, name: string, enabled = true): Skill {
  return {
    id,
    name,
    description: `What ${name} does`,
    type: "rubric",
    source: "manual",
    body: `# ${name}`,
    enabled,
    version: 1,
    agent_count: 0,
  };
}

// Deliberately not alphabetical: the tab must order positioned rows by their
// stored `order` and the rest by name, not by whatever the API returned.
const SKILLS: Skill[] = [
  skill("s1", "alpha-gate"),
  skill("s2", "beta-rules"),
  skill("s3", "zeta-legacy", false),
  skill("s4", "delta-extra"),
];

// beta-rules is first in the prompt, alpha-gate second, and zeta-legacy holds
// third place with its box cleared — the state a link-or-nothing model could
// not represent.
const LINKS: AgentSkillLink[] = [
  { agent_id: "ag1", skill_id: "s2", order: 0, enabled: true },
  { agent_id: "ag1", skill_id: "s1", order: 1, enabled: true },
  { agent_id: "ag1", skill_id: "s3", order: 2, enabled: false },
];

const setSkills = vi.fn();

vi.mock("../../../../../../../lib/hooks/agents", () => ({
  useAgentSkills: () => ({ data: LINKS, isLoading: false, isError: false, refetch: vi.fn() }),
  useSetAgentSkills: () => ({ mutate: setSkills, isPending: false }),
}));

vi.mock("../../../../../../../lib/hooks/skills", () => ({
  useSkills: () => ({ data: SKILLS, isLoading: false, isError: false, refetch: vi.fn() }),
}));

import { SkillsTab } from "./SkillsTab";

beforeEach(() => setSkills.mockClear());
afterEach(cleanup);

function renderTab() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ agents: messages, skills }}>
      <ToastProvider>
        <SkillsTab agent={AGENT} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

/** The list posted by the single `useSetAgentSkills` call the UI just made. */
function posted(): Array<{ skill_id: string; enabled: boolean }> {
  expect(setSkills).toHaveBeenCalledTimes(1);
  const vars = setSkills.mock.calls[0]?.[0] as {
    agentId: string;
    skills: Array<{ skill_id: string; enabled: boolean }>;
  };
  expect(vars.agentId).toBe("ag1");
  return vars.skills;
}

/** The nth rendered skill row — positioned rows first, then the rest. */
function row(index: number): HTMLElement {
  const found = screen.getAllByRole("listitem")[index];
  if (!found) throw new Error(`no skill row at index ${index}`);
  return found;
}

/** The reorder handle of the row for `name`. */
function handle(name: string): HTMLElement {
  return screen.getByRole("button", {
    name: `Reorder “${name}” — press the up or down arrow key`,
  });
}

describe("Agent editor — Skills tab", () => {
  it("lists positioned skills in their stored order, then the rest alphabetically", () => {
    renderTab();

    expect(within(row(0)).getByText("beta-rules")).toBeInTheDocument();
    expect(within(row(1)).getByText("alpha-gate")).toBeInTheDocument();
    expect(within(row(2)).getByText("zeta-legacy")).toBeInTheDocument();
    expect(within(row(3)).getByText("delta-extra")).toBeInTheDocument();

    expect(screen.getByText("2 of 4 enabled")).toBeInTheDocument();
  });

  it("labels each row with its translated type, not the raw enum value", () => {
    renderTab();

    // Guards the `skills` namespace this tab needs but does not own: a missing
    // one renders "listItem.type.rubric" and next-intl only logs about it.
    expect(within(row(0)).getByText("rubric")).toBeInTheDocument();
    expect(screen.queryByText(/listItem\.type/)).not.toBeInTheDocument();
  });

  it("reflects each row's flag in its checkbox, including a positioned row that is off", () => {
    renderTab();

    expect(screen.getByRole("checkbox", { name: "beta-rules" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "zeta-legacy" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "delta-extra" })).not.toBeChecked();
  });

  it("turns a row on without moving it, posting the whole list", () => {
    renderTab();
    fireEvent.click(screen.getByRole("checkbox", { name: "delta-extra" }));

    expect(posted()).toEqual([
      { skill_id: "s2", enabled: true },
      { skill_id: "s1", enabled: true },
      { skill_id: "s3", enabled: false },
      { skill_id: "s4", enabled: true },
    ]);
  });

  it("keeps a row's position when it is turned off", () => {
    renderTab();
    fireEvent.click(screen.getByRole("checkbox", { name: "beta-rules" }));

    // beta-rules is still first — cleared, not removed.
    expect(posted()).toEqual([
      { skill_id: "s2", enabled: false },
      { skill_id: "s1", enabled: true },
      { skill_id: "s3", enabled: false },
      { skill_id: "s4", enabled: false },
    ]);
  });

  it("moves a row earlier when ArrowUp is pressed on its handle", () => {
    renderTab();
    fireEvent.keyDown(handle("alpha-gate"), { key: "ArrowUp" });

    expect(posted()).toEqual([
      { skill_id: "s1", enabled: true },
      { skill_id: "s2", enabled: true },
      { skill_id: "s3", enabled: false },
      { skill_id: "s4", enabled: false },
    ]);
  });

  it("writes nothing when the first row is moved up", () => {
    renderTab();
    fireEvent.keyDown(handle("beta-rules"), { key: "ArrowUp" });
    expect(setSkills).not.toHaveBeenCalled();
  });

  it("marks a globally disabled skill as needing vetting, and still lets it be checked", () => {
    renderTab();
    const legacy = row(2);

    expect(within(legacy).getByText("needs vetting")).toBeInTheDocument();

    fireEvent.click(within(legacy).getByRole("checkbox", { name: "zeta-legacy" }));
    expect(posted()).toEqual([
      { skill_id: "s2", enabled: true },
      { skill_id: "s1", enabled: true },
      { skill_id: "s3", enabled: true },
      { skill_id: "s4", enabled: false },
    ]);
  });

  it("filters the rendered rows without touching the posted order", () => {
    renderTab();
    fireEvent.change(screen.getByLabelText("Filter skills…"), { target: { value: "delta" } });

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(within(row(0)).getByText("delta-extra")).toBeInTheDocument();

    // The write still carries every row, in the full list's order.
    fireEvent.click(screen.getByRole("checkbox", { name: "delta-extra" }));
    expect(posted().map((e) => e.skill_id)).toEqual(["s2", "s1", "s3", "s4"]);
  });
});
