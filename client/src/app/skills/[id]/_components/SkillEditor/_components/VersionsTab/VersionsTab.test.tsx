import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill, SkillVersion } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";

const SKILL: Skill = {
  id: "sk1",
  name: "edge-case-coverage",
  description: "Name the edge cases a changed function stops handling.",
  type: "rubric",
  source: "manual",
  // v2 dropped a line and added one — the diff has to show both.
  body: "# Edge case coverage\n\nEnumerate boundaries.\nName the untested ones.",
  enabled: true,
  version: 2,
  agent_count: 0,
};

const VERSIONS: SkillVersion[] = [
  {
    skill_id: "sk1",
    version: 1,
    body: "# Edge case coverage\n\nEnumerate boundaries.\nList them.",
    created_at: "2026-06-18T10:00:00.000Z",
  },
  {
    skill_id: "sk1",
    version: 2,
    body: SKILL.body,
    created_at: "2026-06-18T11:00:00.000Z",
  },
];

const updateAsync = vi.fn();

vi.mock("../../../../../../../lib/hooks/skills", () => ({
  useSkillVersions: () => ({ data: VERSIONS, isLoading: false, isError: false, refetch: vi.fn() }),
  useUpdateSkill: () => ({ mutateAsync: updateAsync, isPending: false }),
}));

import { VersionsTab } from "./VersionsTab";

beforeEach(() => {
  updateAsync.mockReset();
  updateAsync.mockResolvedValue({ ...SKILL, version: 3 });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderTab() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <ToastProvider>
        <VersionsTab skill={SKILL} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

function row(index: number): HTMLElement {
  const found = screen.getAllByRole("listitem")[index];
  if (!found) throw new Error(`no version row at index ${index}`);
  return found;
}

describe("Skill editor — Versions tab", () => {
  it("lists versions newest first and marks the current one", () => {
    renderTab();

    expect(screen.getByText("Version history · 2 versions")).toBeInTheDocument();
    expect(within(row(0)).getByText("v2")).toBeInTheDocument();
    expect(within(row(0)).getByText("Current")).toBeInTheDocument();
    expect(within(row(1)).getByText("v1")).toBeInTheDocument();
    expect(within(row(1)).getByRole("button", { name: "Restore" })).toBeInTheDocument();
  });

  it("labels a row with the body's first line, stripped of heading markers", () => {
    renderTab();
    expect(within(row(0)).getByText("Edge case coverage")).toBeInTheDocument();
  });

  it("shows added and removed lines when a past version's diff is opened", () => {
    renderTab();
    fireEvent.click(
      within(row(1)).getByRole("button", {
        name: "Show what changed between v1 and the current body",
      }),
    );

    const diff = within(row(1)).getByText(/List them/);
    expect(diff).toHaveTextContent("-List them.");
    expect(within(row(1)).getByText(/Name the untested ones/)).toHaveTextContent(
      "+Name the untested ones.",
    );
  });

  it("says there is nothing to compare on the current version", () => {
    renderTab();
    fireEvent.click(
      within(row(0)).getByRole("button", {
        name: "Show what changed between v2 and the current body",
      }),
    );

    expect(
      within(row(0)).getByText("This is the current body — nothing to compare."),
    ).toBeInTheDocument();
  });

  it("restores by saving the old body as a NEW version, after a confirm", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderTab();

    fireEvent.click(within(row(1)).getByRole("button", { name: "Restore" }));

    // The save resolves and then raises a toast, so the assertion has to wait
    // for that second state update rather than racing it.
    await waitFor(() =>
      expect(updateAsync).toHaveBeenCalledWith({ id: "sk1", patch: { body: VERSIONS[0]!.body } }),
    );
    expect(await screen.findByText("Restored v1 — saved as v3")).toBeInTheDocument();
  });

  it("writes nothing when the restore confirm is declined", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderTab();

    fireEvent.click(within(row(1)).getByRole("button", { name: "Restore" }));
    expect(updateAsync).not.toHaveBeenCalled();
  });
});
