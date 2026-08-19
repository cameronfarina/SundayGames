import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  LiveDraftAdvisory,
  LiveDraftAdvisoryPlayer,
} from "../api/liveDraftAdvisorySchemas";
import {
  advisoryBasisLabel,
  advisoryByPlayerName,
  advisorySummary,
  injuryLabel,
  momentumLabel,
} from "./liveDraftAdvisory";

const player = (overrides: Partial<LiveDraftAdvisoryPlayer> = {}): LiveDraftAdvisoryPlayer => ({
  normalizedPlayerName: "Puka Nacua",
  rankEcr: 3,
  momentum: "steady",
  ...overrides,
});

const advisory = (overrides: Partial<LiveDraftAdvisory> = {}): LiveDraftAdvisory => ({
  configured: true,
  basis: "ros",
  week: null,
  players: [],
  ...overrides,
});

describe("advisoryByPlayerName", () => {
  it("keys each player by the name the board rows use", () => {
    const map = advisoryByPlayerName(advisory({ players: [player()] }));

    expect(map.get("Puka Nacua")?.rankEcr).toBe(3);
  });

  it("is empty when no advisory loaded", () => {
    expect(advisoryByPlayerName(undefined).size).toBe(0);
  });
});

describe("advisoryBasisLabel", () => {
  it("names the rest-of-season basis", () => {
    expect(advisoryBasisLabel(advisory())).toBe("rest-of-season ranks");
  });

  it("names the week when serving weekly ranks", () => {
    expect(advisoryBasisLabel(advisory({ basis: "weekly", week: 7 }))).toBe("week 7 ranks");
  });

  it("falls back to a bare weekly label when the week is unknown", () => {
    expect(advisoryBasisLabel(advisory({ basis: "weekly", week: null }))).toBe("weekly ranks");
  });
});

describe("momentumLabel", () => {
  it("reads a positive delta as a rank moving up", () => {
    expect(momentumLabel(player({ momentum: "rising", ecrDelta: 4 })))
      .toBe("consensus rank up 4");
  });

  it("reads a negative delta as a rank moving down", () => {
    expect(momentumLabel(player({ momentum: "falling", ecrDelta: -6 })))
      .toBe("consensus rank down 6");
  });

  it("reports no movement when the delta is missing", () => {
    expect(momentumLabel(player({ momentum: "rising" }))).toBe("consensus rank up 0");
  });
});

describe("advisorySummary", () => {
  it("lists rank, position rank, tier, and momentum", () => {
    expect(advisorySummary(player({
      positionRank: "WR2",
      tier: 1,
      momentum: "rising",
      ecrDelta: 4,
    }))).toBe("Consensus rank 3 · WR2 · tier 1 · consensus rank up 4");
  });

  it("lists the rank alone when nothing else is known", () => {
    expect(advisorySummary(player())).toBe("Consensus rank 3");
  });
});

describe("injuryLabel", () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it("names the report and when FantasyPros filed it", () => {
    vi.stubEnv("TZ", "America/New_York");

    expect(injuryLabel({
      headline: "Gibbs is limited with an ankle injury",
      publishedAt: "2026-09-17T12:19:00.000Z",
    })).toBe("Injury report: Gibbs is limited with an ankle injury (9/17 8:19am)");
  });

  it("keeps the report when the timestamp cannot be read", () => {
    expect(injuryLabel({
      headline: "Gibbs is limited with an ankle injury",
      publishedAt: "not-a-date",
    })).toBe("Injury report: Gibbs is limited with an ankle injury");
  });
});
