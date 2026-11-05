import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { NAV, Sidebar, type LinkLike } from "@devdigest/ui";
import { activeKeyFor } from "./helpers";

// L08 — the GLOBAL → Agent Performance sidebar entry (R-42, F-06).
afterEach(cleanup);

const PlainLink: LinkLike = ({ href, children }) => <a href={href}>{children}</a>;

function entry(): HTMLElement {
  return screen.getByRole("link", { name: "Agent Performance" });
}

/** NavItem marks the active item by weight and an accent bar; the weight is the stable signal. */
function isHighlighted(link: HTMLElement): boolean {
  return (link.firstElementChild as HTMLElement).style.fontWeight === "600";
}

describe("GLOBAL → Agent Performance", () => {
  it("is declared repo-independent in the GLOBAL group", () => {
    const global = NAV.find((g) => g.section === "GLOBAL");
    const item = global?.items.find((i) => i.key === "agent-performance");
    expect(item?.href).toBe("/agent-performance");
    expect(item?.href).not.toContain(":repoId");
    expect(activeKeyFor("/agent-performance")).toBe("agent-performance");
  });

  it("links to the dashboard with and without an active repo, highlighted only on its route", () => {
    render(<Sidebar ctx={{ Link: PlainLink, repoId: null, activeKey: activeKeyFor("/agent-performance") }} />);
    expect(screen.getByText("GLOBAL")).toBeInTheDocument();
    expect(entry()).toHaveAttribute("href", "/agent-performance");
    expect(isHighlighted(entry())).toBe(true);
    cleanup();

    render(<Sidebar ctx={{ Link: PlainLink, repoId: "r1", activeKey: activeKeyFor("/repos/r1/pulls") }} />);
    expect(entry()).toHaveAttribute("href", "/agent-performance");
    expect(isHighlighted(entry())).toBe(false);
  });
});
