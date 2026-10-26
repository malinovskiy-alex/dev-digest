import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { DownstreamImpact } from "@devdigest/shared";
import blast from "../../../../../../../../../../messages/en/blast.json";
import { BlastGraph } from "./BlastGraph";

afterEach(() => cleanup());

function renderGraph(downstream: DownstreamImpact[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ blast }}>
      <BlastGraph downstream={downstream} />
    </NextIntlClientProvider>,
  );
}

const WITH_CRON: DownstreamImpact[] = [
  {
    symbol: "getContext",
    callers: [
      { name: "apiRoutes", file: "src/api/routes.ts", line: 4, endpoints: ["GET /a"], crons: ["nightly"] },
    ],
    endpoints_affected: ["GET /a"],
    crons_affected: ["nightly"],
  },
];

describe("BlastGraph", () => {
  it("renders node labels as SVG text with a legend; the cron entry only when crons exist", () => {
    renderGraph(WITH_CRON);
    const svg = screen.getByRole("img", { name: /Blast radius graph/ });
    expect(svg).toHaveAccessibleName(/1 changed symbols, 1 callers, 2 endpoints and crons/);
    expect(screen.getByText("getContext()", { selector: "text" })).toBeInTheDocument();
    expect(screen.getByText("apiRoutes", { selector: "text" })).toBeInTheDocument();
    expect(screen.getByText("GET /a", { selector: "text" })).toBeInTheDocument();
    expect(screen.getByText("nightly", { selector: "text" })).toBeInTheDocument();
    expect(screen.getByText("changed symbol")).toBeInTheDocument();
    expect(screen.getByText("endpoints affected")).toBeInTheDocument();
    expect(screen.getByText("crons / jobs")).toBeInTheDocument();
    cleanup();

    renderGraph([
      { ...WITH_CRON[0]!, callers: [{ ...WITH_CRON[0]!.callers[0]!, crons: [] }], crons_affected: [] },
    ]);
    expect(screen.getByText("callers")).toBeInTheDocument();
    expect(screen.queryByText("crons / jobs")).not.toBeInTheDocument();
  });

  it("shows the empty state for no downstream", () => {
    renderGraph([]);
    expect(screen.getByText("No downstream callers to graph.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
