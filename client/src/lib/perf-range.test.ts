import { describe, it, expect } from "vitest";
import {
  bucketFor,
  fillBuckets,
  parseRangeParams,
  resolveRange,
  statsHref,
  todayLocal,
  validateCustom,
  type PerfRangeChoice,
} from "./perf-range";

const HOUR = 3_600_000;
const sp = (q: string) => new URLSearchParams(q);
// A fixed local "now": 2026-11-05 14:00 in the test runner's zone.
const NOW = new Date(2026, 10, 5, 14, 0, 0);
const THIRTY: PerfRangeChoice = { kind: "preset", preset: "30d", at: null };

describe("parseRangeParams (R-33, R-39)", () => {
  it("reads valid addresses and falls back to 30 days on anything else", () => {
    expect(parseRangeParams(sp(""), NOW)).toEqual(THIRTY);
    expect(parseRangeParams(sp("range=1d"), NOW)).toEqual({ kind: "preset", preset: "1d", at: null });
    expect(parseRangeParams(sp("range=custom&start=2026-10-01&end=2026-10-07"), NOW)).toEqual({
      kind: "custom",
      start: "2026-10-01",
      end: "2026-10-07",
    });
    const at = new Date(NOW.getTime() - HOUR).toISOString();
    expect(parseRangeParams(sp(`range=30d&at=${encodeURIComponent(at)}`), NOW)).toEqual({
      kind: "preset",
      preset: "30d",
      at,
    });

    for (const bad of [
      "range=custom&start=2026-10-07&end=2026-10-01", // end before start
      "range=custom&start=2026-11-01&end=2026-11-06", // future end
      "range=custom&start=2026-02-31&end=2026-03-01", // not a calendar date
      "range=custom&start=20261001&end=2026-10-07", // malformed
      "range=week",
      "range=1d&at=garbage",
      `range=1d&at=${encodeURIComponent(new Date(NOW.getTime() + HOUR).toISOString())}`, // future at
      "range=30d&at=0001-01-01T00:00:00.000Z", // year 1 — Postgres would 500 (F-08)
      "range=30d&at=1970-01-31T00:00:00.000Z", // previous window starts 1969-12-02 (F-08)
      "range=custom&start=0100-01-01&end=0100-01-02", // two-digit-century year (F-08)
      "range=custom&start=1970-01-05&end=1970-02-05", // previous window before 1970 (F-08)
    ]) {
      expect(parseRangeParams(sp(bad), NOW)).toEqual(THIRTY);
    }
  });
});

describe("resolveRange (R-34, R-35)", () => {
  it("rolls presets back from the apply moment or the pinned end", () => {
    const d1 = resolveRange({ kind: "preset", preset: "1d", at: null }, NOW);
    expect(d1.to.getTime()).toBe(NOW.getTime());
    expect(d1.to.getTime() - d1.from.getTime()).toBe(24 * HOUR);
    const d30 = resolveRange(THIRTY, NOW);
    expect(d30.to.getTime() - d30.from.getTime()).toBe(720 * HOUR);
    const at = "2026-10-01T12:00:00.000Z";
    expect(resolveRange({ kind: "preset", preset: "30d", at }, NOW).to.toISOString()).toBe(at);
  });

  it("turns a custom range into local midnights, end date inclusive", () => {
    const r = resolveRange({ kind: "custom", start: "2026-10-01", end: "2026-10-07" }, NOW);
    expect(r.from.getTime()).toBe(new Date(2026, 9, 1).getTime());
    expect(r.to.getTime()).toBe(new Date(2026, 9, 8).getTime());
    // A DST week is 167 or 169 hours where the zone has DST; always midnight to midnight.
    const hours = (r.to.getTime() - r.from.getTime()) / HOUR;
    expect([167, 168, 169]).toContain(hours);
    expect(r.from.getHours()).toBe(0);
    expect(r.to.getHours()).toBe(0);
  });
});

describe("validateCustom (R-36, R-37)", () => {
  it("names the first problem, or null", () => {
    const today = todayLocal(NOW);
    expect(today).toBe("2026-11-05");
    expect(validateCustom("2026-10-07", "2026-10-01", today)).toBe("endBeforeStart");
    expect(validateCustom("2026-11-01", "2026-11-06", today)).toBe("future");
    expect(validateCustom("", "2026-11-01", today)).toBe("missing");
    expect(validateCustom("2026-11-05", "2026-11-05", today)).toBeNull();
    // F-08: the range and its previous window must start on or after 1970-01-01T00:00Z.
    expect(validateCustom("1970-01-05", "1970-02-05", today)).toBe("tooEarly");
    expect(validateCustom("1971-01-01", "1971-01-31", today)).toBeNull();
  });

  it("accepts a pinned end whose previous window starts exactly at the bound (F-08)", () => {
    const at = new Date(Date.UTC(1970, 0, 1) + 2 * 24 * HOUR).toISOString();
    expect(parseRangeParams(sp(`range=1d&at=${encodeURIComponent(at)}`), NOW)).toEqual({
      kind: "preset",
      preset: "1d",
      at,
    });
  });
});

describe("statsHref (R-56, D-8)", () => {
  it("pins a preset's end and carries a custom range's dates", () => {
    const range = { from: new Date("2026-10-06T14:00:00.000Z"), to: new Date("2026-11-05T14:00:00.000Z") };
    const preset = new URL(statsHref("ag 1", THIRTY, range), "http://x");
    expect(preset.pathname).toBe("/agents/ag%201");
    expect(preset.searchParams.get("tab")).toBe("stats");
    expect(preset.searchParams.get("range")).toBe("30d");
    expect(preset.searchParams.get("at")).toBe("2026-11-05T14:00:00.000Z");

    const custom = new URL(
      statsHref("a1", { kind: "custom", start: "2026-10-01", end: "2026-10-07" }, range),
      "http://x",
    );
    expect(custom.searchParams.get("range")).toBe("custom");
    expect(custom.searchParams.get("start")).toBe("2026-10-01");
    expect(custom.searchParams.get("end")).toBe("2026-10-07");
    expect(custom.searchParams.get("at")).toBeNull();
  });
});

describe("bucketFor and fillBuckets (R-90, R-91, D-18)", () => {
  it("uses hours only for the 1-day preset", () => {
    expect(bucketFor({ kind: "preset", preset: "1d", at: null })).toBe("hour");
    expect(bucketFor(THIRTY)).toBe("day");
    expect(bucketFor({ kind: "custom", start: "2026-11-05", end: "2026-11-05" })).toBe("day");
  });

  it("has one point per local day touched, zero-filled, summing to the given runs", () => {
    const to = new Date("2026-11-05T14:00:00.000Z");
    const rolling = { from: new Date(to.getTime() - 720 * HOUR), to };
    const buckets = [
      { key: "2026-10-06", runs: 2 },
      { key: "2026-10-20", runs: 3 },
      { key: "2026-11-05", runs: 1 },
    ];
    const pts = fillBuckets(rolling, "day", buckets, "UTC");
    expect(pts).toHaveLength(31);
    expect(pts[0]).toBe(2);
    expect(pts[30]).toBe(1);
    expect(pts.reduce((a, b) => a + b, 0)).toBe(6);

    const midnight = { from: new Date("2026-10-06T00:00:00.000Z"), to: new Date("2026-11-05T00:00:00.000Z") };
    expect(fillBuckets(midnight, "day", [], "UTC")).toHaveLength(30);

    // Kyiv is UTC+2 in November: 22:00Z on Nov 4 is already 00:00 on Nov 5 there.
    const kyiv = { from: new Date("2026-11-04T22:00:00.000Z"), to: new Date("2026-11-05T22:00:00.000Z") };
    expect(fillBuckets(kyiv, "day", [{ key: "2026-11-05", runs: 4 }], "Europe/Kyiv")).toEqual([4]);
  });

  it("has 24 hour points for a day, 25 unique keys across a fall-back hour", () => {
    const to = new Date("2026-11-05T14:00:00.000Z");
    const day = { from: new Date(to.getTime() - 24 * HOUR), to };
    const pts = fillBuckets(day, "hour", [{ key: "2026-11-05T13", runs: 5 }], "UTC");
    expect(pts).toHaveLength(24);
    expect(pts[23]).toBe(5);

    // New York falls back on 2026-11-01 at 02:00 local: 01:xx happens twice and merges.
    const fallBack = { from: new Date("2026-11-01T04:00:00.000Z"), to: new Date("2026-11-02T05:00:00.000Z") };
    const hours = fillBuckets(fallBack, "hour", [{ key: "2026-11-01T01", runs: 2 }], "America/New_York");
    // 25 real hours (local midnight to midnight), but only 24 distinct local hour keys.
    expect(hours).toHaveLength(24);
    expect(hours.reduce((a, b) => a + b, 0)).toBe(2);
  });
});
