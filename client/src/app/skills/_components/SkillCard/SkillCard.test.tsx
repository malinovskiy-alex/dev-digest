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
    // L08 skill-stats R-71/R-77: without a pull frequency the badge carries the count only.
    expect(screen.getByText("2 agents")).toBeInTheDocument();
    expect(screen.queryByText(/pull freq/)).not.toBeInTheDocument();
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

describe("SkillCard — pull frequency (L08 skill-stats C8)", () => {
  /** The card root: the only button carrying aria-pressed. */
  const card = () => screen.getByRole("button", { pressed: false });
  const HINT = "PRs reviewed in the last 30 days with an agent that uses this skill";

  /** The hint element: aria-hidden, so it is reached through the card's description, not a role. */
  const hint = () => document.getElementById(card().getAttribute("aria-describedby")!)!;

  it("shows '<N> agents · <p>% pull freq'; the hint is the card's description, read once — not part of its name (R-71, R-82, R-83, F-05)", () => {
    renderCard(<SkillCard skill={{ ...SKILL, agent_count: 2 }} pullFrequency={{ status: "ready", rate: 1 }} />);
    expect(card()).toHaveTextContent("2 agents · 100% pull freq");
    expect(card()).toHaveAccessibleDescription(HINT);
    expect(card()).toHaveAccessibleName(expect.stringContaining("2 agents · 100% pull freq"));
    expect(card()).not.toHaveAccessibleName(expect.stringContaining(HINT));
    // Only the card carries the description; the figure's own text does not repeat it.
    expect(screen.getByText(/100% pull freq/)).not.toHaveAttribute("aria-describedby");
    expect(hint()).toHaveAttribute("aria-hidden", "true");
    expect(hint()).toHaveTextContent(HINT);
  });

  it("shows the hint only on the pull-frequency badge's hover or the card's keyboard focus, below the badge row — never over the description (F-18)", () => {
    renderCard(
      <SkillCard skill={{ ...SKILL, agent_count: 2 }} pullFrequency={{ status: "ready", rate: 1 }} />,
    );
    // Tailwind is not loaded in jsdom, so read the class contract: the hover
    // target is the badge (not the whole card), the hint itself stays hoverable
    // (WCAG 1.4.13), and keyboard focus on the card root shows it too.
    expect(hint()).toHaveClass(
      "invisible",
      "group-has-[[data-pull-freq-badge]:hover]:visible",
      "hover:visible",
      "group-focus-visible:visible",
    );
    expect(hint()).not.toHaveClass("group-hover:visible");
    expect(hint()).not.toHaveClass("group-focus-within:visible");
    // F-19: the line is reserved — only `visibility` toggles, never `display`, so
    // hovering the badge cannot change the card's height or shift the grid/rail.
    expect(hint()).toHaveClass("block");
    expect(hint()).not.toHaveClass("hidden");
    const variants = [...hint().classList].filter((c) => c.includes(":"));
    expect(variants.every((c) => c.endsWith(":visible"))).toBe(true);
    // The hover target wraps exactly the "· X% pull freq" badge.
    const target = card().querySelector("[data-pull-freq-badge]");
    expect(target).toHaveTextContent("2 agents · 100% pull freq");
    expect(target).not.toHaveTextContent("v1");
    // In the card's flow after the badge row, not an overlay: it cannot cover the
    // description, and the rail's overflow cannot clip it.
    expect(hint()).not.toHaveClass("absolute");
    const description = screen.getByText(SKILL.description);
    expect(description.compareDocumentPosition(target!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(target!.compareDocumentPosition(hint()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(hint().previousElementSibling).toContainElement(target as HTMLElement);
  });

  it("dismisses the hint on Escape until the pointer or focus leaves, without opening the skill (F-05, WCAG 1.4.13)", () => {
    const onClick = vi.fn();
    renderCard(<SkillCard skill={SKILL} onClick={onClick} pullFrequency={{ status: "ready", rate: 1 }} />);
    expect(hint()).toHaveClass("group-has-[[data-pull-freq-badge]:hover]:visible");

    fireEvent.keyDown(card(), { key: "Escape" });
    // Dismissed = invisible with its line still reserved (F-19): no hover/focus variant can reveal it.
    expect(hint()).toHaveClass("invisible", "block");
    expect(hint()).not.toHaveClass("hidden");
    expect([...hint().classList].some((c) => c.endsWith(":visible"))).toBe(false);
    expect(onClick).not.toHaveBeenCalled();
    // Still the card's description while dismissed.
    expect(card()).toHaveAccessibleDescription(HINT);

    fireEvent.mouseLeave(card());
    expect(hint()).toHaveClass("group-has-[[data-pull-freq-badge]:hover]:visible");

    fireEvent.keyDown(card(), { key: "Escape" });
    fireEvent.blur(card());
    expect(hint()).toHaveClass("group-focus-visible:visible");
  });

  it("keeps the hint dismissed while focus moves to the card's own Toggle or delete, and resets once it leaves the card (F-17)", () => {
    renderCard(
      <>
        <SkillCard skill={SKILL} onToggle={vi.fn()} pullFrequency={{ status: "ready", rate: 1 }} />
        <button type="button">outside</button>
      </>,
    );
    const dismissed = () => !hint().classList.contains("group-has-[[data-pull-freq-badge]:hover]:visible");

    fireEvent.keyDown(card(), { key: "Escape" });
    expect(dismissed()).toBe(true);

    // Card root → delete button: focus stays inside the card.
    fireEvent.blur(card(), { relatedTarget: deleteButton() });
    expect(dismissed()).toBe(true);
    // Delete button → Toggle: still inside (the event bubbles to the card root).
    fireEvent.blur(deleteButton(), { relatedTarget: screen.getByRole("switch") });
    expect(dismissed()).toBe(true);

    // Toggle → a control outside the card: focus has left, the hint is back.
    fireEvent.blur(screen.getByRole("switch"), { relatedTarget: screen.getByRole("button", { name: "outside" }) });
    expect(dismissed()).toBe(false);

    // Focus leaving the document altogether (relatedTarget null) resets too.
    fireEvent.keyDown(card(), { key: "Escape" });
    expect(dismissed()).toBe(true);
    fireEvent.blur(deleteButton());
    expect(dismissed()).toBe(false);
  });

  it("dashes an unknown rate, never '0%' (R-75)", () => {
    renderCard(<SkillCard skill={{ ...SKILL, agent_count: 1 }} pullFrequency={{ status: "ready", rate: null }} />);
    expect(card()).toHaveTextContent("1 agent · — pull freq");
    expect(card()).not.toHaveTextContent("%");
  });

  it("shows the count and a placeholder while loading, and the count only on failure or without a value (R-76, R-77)", () => {
    renderCard(<SkillCard skill={{ ...SKILL, agent_count: 2 }} pullFrequency={{ status: "loading" }} />);
    expect(card()).toHaveTextContent("2 agents");
    expect(card()).not.toHaveTextContent("%");
    expect(card()).not.toHaveAttribute("aria-describedby");
    cleanup();

    for (const pullFrequency of [{ status: "error" } as const, undefined]) {
      renderCard(<SkillCard skill={{ ...SKILL, agent_count: 2 }} pullFrequency={pullFrequency} />);
      expect(screen.getByText("2 agents")).toBeInTheDocument();
      expect(card()).not.toHaveTextContent("pull freq");
      expect(card()).not.toHaveAttribute("aria-describedby");
      cleanup();
    }
  });

  /** The reserved hint band under the badge row: aria-hidden, the card's last child. */
  const band = () => card().lastElementChild as HTMLElement;

  it("reserves the hint band while loading or failed — never shown, never describing the card (F-20)", () => {
    for (const pullFrequency of [{ status: "loading" } as const, { status: "error" } as const]) {
      renderCard(<SkillCard skill={{ ...SKILL, agent_count: 2 }} pullFrequency={pullFrequency} />);
      expect(band()).toHaveAttribute("aria-hidden", "true");
      expect(band()).toHaveClass("invisible", "block");
      expect(band()).not.toHaveClass("hidden");
      // No hover/focus variant can reveal it, and no id the card could point at.
      expect([...band().classList].some((c) => c.endsWith(":visible"))).toBe(false);
      expect(band()).not.toHaveAttribute("id");
      expect(card()).not.toHaveAttribute("aria-describedby");
      // Escape changes nothing about a band that is never shown.
      fireEvent.keyDown(card(), { key: "Escape" });
      expect([...band().classList].some((c) => c.endsWith(":visible"))).toBe(false);
      cleanup();
    }

    // Without a pull frequency there is no badge suffix and no band at all.
    renderCard(<SkillCard skill={{ ...SKILL, agent_count: 2 }} />);
    expect(card()).not.toHaveTextContent("PRs reviewed");
    expect(card().querySelector('[aria-hidden="true"] > span')).toBeNull();
  });

  it("keeps the same band when the read lands, so the card's height never changes (F-20)", () => {
    const view = renderCard(<SkillCard skill={{ ...SKILL, agent_count: 2 }} pullFrequency={{ status: "loading" }} />);
    const reserved = band();
    expect(reserved).toHaveTextContent(HINT);

    view.rerender(
      <NextIntlClientProvider locale="en" messages={{ skills: messages, common }}>
        <ToastProvider>
          <SkillCard skill={{ ...SKILL, agent_count: 2 }} pullFrequency={{ status: "ready", rate: 0.5 }} />
        </ToastProvider>
      </NextIntlClientProvider>,
    );
    // Same node, same text, same reserved box — only its id and hover/focus variants change.
    expect(band()).toBe(reserved);
    expect(hint()).toBe(reserved);
    expect(reserved).toHaveTextContent(HINT);
    expect(reserved).toHaveClass("invisible", "block", "group-focus-visible:visible");
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
