import { describe, it, expect, afterEach } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { comparison, figures, renderWithPerfIntl } from "@/test/agent-performance-fixtures";
import { AcceptRateValue } from "./AcceptRateValue";

afterEach(cleanup);

describe("AcceptRateValue", () => {
  it("prints the banded percent, the denominator and the trend text (R-53, R-96, R-100)", () => {
    renderWithPerfIntl(<AcceptRateValue figures={figures()} comparison={comparison()} variant="row" />);
    expect(screen.getByText("80%").style.color).toBe("var(--ok)");
    expect(screen.getByText("8/10")).toBeInTheDocument();
    expect(screen.getByText("up from 60%")).toBeInTheDocument();
    expect(screen.queryByText("Small sample")).not.toBeInTheDocument();
  });

  it("stays neutral and badged on a small sample; no arrow when flat or unknown (R-61, R-97, R-101)", () => {
    renderWithPerfIntl(
      <AcceptRateValue
        figures={figures({ accepted: 3, dismissed: 1, decided: 4, accept_rate: 0.75 })}
        comparison={comparison({ accept_trend: "flat" })}
        variant="row"
      />,
    );
    expect(screen.getByText("75%").style.color).toBe("var(--text-secondary)");
    expect(screen.getByText("Small sample")).toBeInTheDocument();
    expect(screen.queryByText(/from \d+%/)).not.toBeInTheDocument();
    cleanup();

    renderWithPerfIntl(
      <AcceptRateValue
        figures={figures()}
        comparison={comparison({ accept_trend: null, previous_accept_rate: null })}
        variant="kpi"
      />,
    );
    expect(screen.getByText("8/10 decisions")).toBeInTheDocument();
    expect(screen.queryByText(/from \d+%/)).not.toBeInTheDocument();
  });

  it("shows an unknown rate as a dash with its variant's caption (R-49, R-53)", () => {
    const none = figures({ accepted: 0, dismissed: 0, decided: 0, accept_rate: null });
    renderWithPerfIntl(<AcceptRateValue figures={none} variant="row" />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("0 decisions")).toBeInTheDocument();
    cleanup();
    renderWithPerfIntl(<AcceptRateValue figures={none} variant="kpi" />);
    expect(screen.getByText("No decided findings")).toBeInTheDocument();
  });
});
