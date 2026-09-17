/**
 * RunCostBadge — the money rules, which are the whole point of the component:
 * an unknown cost is "—" and NEVER "$0.00" (unknown price ≠ free), and a real
 * sub-cent run keeps enough decimals to stay visible.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import common from "../../../messages/en/common.json";
import { RunCostBadge, type RunCostBadgeProps } from "./RunCostBadge";

afterEach(cleanup);

function renderBadge(props: RunCostBadgeProps) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ common }}>
      <RunCostBadge {...props} />
    </NextIntlClientProvider>,
  );
}

describe("RunCostBadge — compact (PR list cell)", () => {
  it("renders a cent-scale cost with three decimals", () => {
    renderBadge({ costUsd: 0.0141 });
    expect(screen.getByText("$0.014")).toBeInTheDocument();
  });

  it("keeps four decimals below a cent, so a real run is never rounded away", () => {
    renderBadge({ costUsd: 0.0013 });
    expect(screen.getByText("$0.0013")).toBeInTheDocument();
  });

  it("shows an em dash — not $0.00 — when the cost is unknown", () => {
    renderBadge({ costUsd: null });
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });

  it("distinguishes a genuinely free run from an unknown one", () => {
    renderBadge({ costUsd: 0 });
    expect(screen.getByText("$0.000")).toBeInTheDocument();
  });
});

describe("RunCostBadge — detailed (PR detail timeline)", () => {
  it("reads '<tokens> tok · <cost>' with the token total grouped", () => {
    renderBadge({ costUsd: 0.0013, tokensIn: 8000, tokensOut: 1119, variant: "detailed" });
    expect(screen.getByText("9,119 tok · $0.0013")).toBeInTheDocument();
  });

  it("still shows the tokens when only the price is unknown", () => {
    renderBadge({ costUsd: null, tokensIn: 100, tokensOut: 50, variant: "detailed" });
    expect(screen.getByText("150 tok · —")).toBeInTheDocument();
  });

  it("renders nothing at all for a run that reported neither (an errored run)", () => {
    const { container } = renderBadge({
      costUsd: null,
      tokensIn: null,
      tokensOut: null,
      variant: "detailed",
    });
    expect(container).toBeEmptyDOMElement();
  });
});
