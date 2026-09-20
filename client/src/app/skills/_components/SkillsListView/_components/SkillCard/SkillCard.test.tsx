import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/skills.json";
import { SkillCard } from "./SkillCard";

afterEach(cleanup);

const SKILL: Skill = {
  id: "sk1",
  name: "uncovered-branch-gate",
  description: "Name the branches of a changed function that no test reaches.",
  type: "rubric",
  source: "manual",
  body: "# Uncovered branch gate",
  enabled: true,
  version: 1,
};

function renderCard(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("SkillCard", () => {
  it("renders the name, the type badge and the description", () => {
    renderCard(<SkillCard skill={SKILL} />);
    expect(screen.getByText("uncovered-branch-gate")).toBeInTheDocument();
    expect(screen.getByText("rubric")).toBeInTheDocument();
    expect(
      screen.getByText("Name the branches of a changed function that no test reaches."),
    ).toBeInTheDocument();
  });

  it("flips the global kill-switch without opening the card", () => {
    const onToggle = vi.fn();
    const onClick = vi.fn();
    renderCard(<SkillCard skill={SKILL} onToggle={onToggle} onClick={onClick} />);

    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");

    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledWith(false);
    // The toggle stops propagation: flipping it must not also select the skill.
    expect(onClick).not.toHaveBeenCalled();
  });

  it("flags an imported skill that has not been enabled yet", () => {
    renderCard(<SkillCard skill={{ ...SKILL, source: "imported_file", enabled: false }} />);
    expect(screen.getByText("needs vetting")).toBeInTheDocument();
  });

  it("drops the vetting flag once the imported skill is enabled", () => {
    renderCard(<SkillCard skill={{ ...SKILL, source: "imported_file", enabled: true }} />);
    expect(screen.queryByText("needs vetting")).not.toBeInTheDocument();
  });

  it("shows how many agents reuse the skill", () => {
    renderCard(<SkillCard skill={SKILL} usedBy={2} />);
    expect(screen.getByText("2 agents")).toBeInTheDocument();
  });
});
