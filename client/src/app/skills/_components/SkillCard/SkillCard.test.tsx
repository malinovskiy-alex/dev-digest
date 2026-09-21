import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../messages/en/skills.json";
// The confirm dialog's Cancel/Close come from the shared `common` namespace.
import common from "../../../../../messages/en/common.json";
import { ToastProvider } from "@/lib/toast";

// The card owns its delete, so it owns the mutation too.
const deleteAsync = vi.fn();
vi.mock("@/lib/hooks/skills", () => ({
  useDeleteSkill: () => ({ mutateAsync: deleteAsync, isPending: false }),
}));

import { SkillCard } from "./SkillCard";

beforeEach(() => {
  deleteAsync.mockReset();
  deleteAsync.mockResolvedValue({ ok: true, unlinked_from: 2 });
});
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
  agent_count: 0,
};

function renderCard(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages, common }}>
      <ToastProvider>{ui}</ToastProvider>
    </NextIntlClientProvider>,
  );
}

/** The card's delete button, which opens the confirm dialog. */
function deleteButton(): HTMLElement {
  return screen.getByRole("button", { name: "Delete “uncovered-branch-gate”" });
}

describe("SkillCard", () => {
  it("renders the name, the type badge, the description, the version and the reuse count", () => {
    renderCard(<SkillCard skill={{ ...SKILL, version: 3, agent_count: 2 }} />);
    expect(screen.getByText("uncovered-branch-gate")).toBeInTheDocument();
    expect(screen.getByText("rubric")).toBeInTheDocument();
    expect(
      screen.getByText("Name the branches of a changed function that no test reaches."),
    ).toBeInTheDocument();
    expect(screen.getByText("v3")).toBeInTheDocument();
    expect(screen.getByText("2 agents")).toBeInTheDocument();
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

  it("selects the skill from the keyboard, not just the mouse", () => {
    const onClick = vi.fn();
    renderCard(<SkillCard skill={SKILL} onClick={onClick} />);
    // The delete button's name also contains the skill name, so address the
    // card by the thing only it has: aria-pressed.
    const card = screen.getByRole("button", { pressed: false });
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(card, { key: " " });
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});

describe("SkillCard — delete", () => {
  it("asks in a dialog rather than deleting on the first click", () => {
    renderCard(<SkillCard skill={{ ...SKILL, agent_count: 2 }} />);

    fireEvent.click(deleteButton());

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Delete “uncovered-branch-gate”?");
    // The stakes are in the question, not discovered afterwards.
    expect(dialog).toHaveTextContent("2 agents currently send this skill");
    expect(deleteAsync).not.toHaveBeenCalled();
  });

  it("offers cancel and a close control, neither of which deletes", () => {
    renderCard(<SkillCard skill={SKILL} />);
    fireEvent.click(deleteButton());

    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(deleteAsync).not.toHaveBeenCalled();
  });

  it("deletes once confirmed, and tells the caller which skill went", async () => {
    const onDeleted = vi.fn();
    renderCard(<SkillCard skill={SKILL} onDeleted={onDeleted} />);
    fireEvent.click(deleteButton());

    fireEvent.click(screen.getByRole("button", { name: "Delete skill" }));

    await waitFor(() => expect(deleteAsync).toHaveBeenCalledWith("sk1"));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(SKILL));
  });

  it("does not select the skill when the delete button is pressed", () => {
    const onClick = vi.fn();
    renderCard(<SkillCard skill={SKILL} onClick={onClick} />);

    fireEvent.click(deleteButton());
    expect(onClick).not.toHaveBeenCalled();
  });
});
