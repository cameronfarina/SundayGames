import { describe, expect, it } from "vitest";
import {
  formatPoints,
  formatRecord,
  formatSyncedAt,
  statusMessage,
  statusPresentation,
} from "./connectionStatus";

describe("connection status", () => {
  it("gives every status a plain-language label and notice colour", () => {
    expect(statusPresentation("pending").label).toBe("Not synced yet");
    expect(statusPresentation("ok").variant).toBe("success");
    expect(statusPresentation("needs_attention").variant).toBe("warning");
    expect(statusPresentation("error").variant).toBe("error");
  });

  it("prefers the provider's own explanation over the generic summary", () => {
    expect(statusMessage("needs_attention", "Paste your espn_s2 cookie."))
      .toBe("Paste your espn_s2 cookie.");
    expect(statusMessage("ok", undefined))
      .toBe("Rosters, matchups, and settings are up to date.");
  });

  it("says a league was never synced instead of showing an unreadable date", () => {
    expect(formatSyncedAt(undefined)).toBe("Never synced");
    expect(formatSyncedAt("not-a-date")).toBe("Never synced");
    expect(formatSyncedAt("2026-08-19T12:00:00.000Z")).toContain("Last synced");
  });

  it("hides a tie column from a league with no ties", () => {
    expect(formatRecord({ wins: 7, losses: 6, ties: 0 })).toBe("7-6");
    expect(formatRecord({ wins: 7, losses: 5, ties: 1 })).toBe("7-5-1");
  });

  it("keeps fantasy points to two decimals", () => {
    expect(formatPoints(1776.0599999)).toBe("1776.06");
  });
});
