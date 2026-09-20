import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Agent, AgentSkillLink, Skill } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/agents.json";
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
  };
}

// Deliberately not alphabetical: the tab must order attached ones by their
// stored `order` and the rest by name, not by whatever the API returned.
const SKILLS: Skill[] = [
  skill("s1", "alpha-gate"),
  skill("s2", "beta-rules"),
  skill("s3", "zeta-legacy", false),
  skill("s4", "delta-extra"),
];

// beta-rules is first in the prompt, alpha-gate second.
const LINKS: AgentSkillLink[] = [
  { agent_id: "ag1", skill_id: "s2", order: 0 },
  { agent_id: "ag1", skill_id: "s1", order: 1 },
];

const setSkills = vi.fn();

vi.mock("../../../../../../../lib/hooks/agents", () => ({
  useAgent: () => ({ refetch: vi.fn().mockResolvedValue({ data: AGENT }) }),
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
    <NextIntlClientProvider locale="en" messages={{ agents: messages }}>
      <ToastProvider>
        <SkillsTab agent={AGENT} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

/** The ids posted by the single `useSetAgentSkills` call the UI just made. */
function postedIds(): string[] {
  expect(setSkills).toHaveBeenCalledTimes(1);
  const vars = setSkills.mock.calls[0]?.[0] as { agentId: string; skillIds: string[] };
  expect(vars.agentId).toBe("ag1");
  return vars.skillIds;
}

/** The nth rendered skill row — attached rows come first, then the rest. */
function row(index: number): HTMLElement {
  const found = screen.getAllByRole("listitem")[index];
  if (!found) throw new Error(`no skill row at index ${index}`);
  return found;
}

describe("Agent editor — Skills tab", () => {
  it("lists the attached skills first, in their stored order, with their position", () => {
    renderTab();

    expect(within(row(0)).getByText("beta-rules")).toBeInTheDocument();
    expect(within(row(0)).getByText("1")).toBeInTheDocument();
    expect(within(row(1)).getByText("alpha-gate")).toBeInTheDocument();
    expect(within(row(1)).getByText("2")).toBeInTheDocument();

    // Then the unattached ones, alphabetically.
    expect(within(row(2)).getByText("delta-extra")).toBeInTheDocument();
    expect(within(row(3)).getByText("zeta-legacy")).toBeInTheDocument();

    expect(screen.getByText("2 of 4 enabled")).toBeInTheDocument();
  });

  it("appends the skill to the ordered list when an unattached row is toggled on", () => {
    renderTab();
    fireEvent.click(screen.getByRole("switch", { name: "Attach “delta-extra” to this agent" }));
    expect(postedIds()).toEqual(["s2", "s1", "s4"]);
  });

  it("removes the skill from the ordered list when an attached row is toggled off", () => {
    renderTab();
    fireEvent.click(screen.getByRole("switch", { name: "Detach “beta-rules” from this agent" }));
    expect(postedIds()).toEqual(["s1"]);
  });

  it("swaps a skill with its predecessor when moved up, and cannot move the first one", () => {
    renderTab();
    expect(screen.getByRole("button", { name: "Move “beta-rules” earlier in the prompt" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Move “alpha-gate” earlier in the prompt" }));
    expect(postedIds()).toEqual(["s1", "s2"]);
  });

  it("shows the disabled note on a globally disabled skill, which stays attachable", () => {
    renderTab();
    const disabled = row(3);

    expect(within(disabled).getByText("zeta-legacy")).toBeInTheDocument();
    expect(
      within(disabled).getByText(
        "Disabled on the Skills page — it will not reach the prompt until you enable it there.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(within(disabled).getByRole("switch"));
    expect(postedIds()).toEqual(["s2", "s1", "s3"]);
  });
});
