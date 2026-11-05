import { describe, it, expect, afterEach } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { comparison, renderWithPerfIntl } from "@/test/agent-performance-fixtures";
import { CostDelta } from "./CostDelta";

afterEach(cleanup);

describe("CostDelta", () => {
  it("shows a signed house-format difference with its label, and nothing when unknown (R-94, R-95)", () => {
    renderWithPerfIntl(<CostDelta comparison={comparison({ cost_delta_usd: -1.2 })} />);
    expect(screen.getByText("−$1.200")).toBeInTheDocument();
    expect(screen.getByText("estimate difference vs previous period")).toBeInTheDocument();
    cleanup();

    renderWithPerfIntl(<CostDelta comparison={comparison({ cost_delta_usd: null, previous_total_cost_usd: null })} />);
    expect(screen.queryByText(/estimate difference/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$0/)).not.toBeInTheDocument();
  });

  it("reads a known delta below display precision as no difference — no sign, no '$' (F-11)", () => {
    renderWithPerfIntl(<CostDelta comparison={comparison({ cost_delta_usd: 0.1 + 0.2 - 0.3 })} />);
    expect(screen.getByText("No estimate difference vs previous period")).toBeInTheDocument();
    expect(screen.queryByText(/[+−]\$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });
});
