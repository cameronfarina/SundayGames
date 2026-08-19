import { describe, expect, it } from "vitest";
import type { FantasyProsStoredRanking } from "../src/platform/fantasyPros.js";
import {
  buildFantasyProsDraftAdvisory,
  type FantasyProsAdvisoryCandidate,
} from "../src/platform/fantasyProsAdvisory.js";

const fetchedAt = "2026-09-10T12:00:00.000Z";

const ranking = (
  overrides: Partial<FantasyProsStoredRanking> & Pick<FantasyProsStoredRanking, "playerId" | "playerName" | "position" | "rankEcr">,
): FantasyProsStoredRanking => ({
  rankingType: "ros",
  scoring: "PPR",
  week: 3,
  fetchedAt,
  ...overrides,
});

const candidate = (
  name: string,
  position: FantasyProsAdvisoryCandidate["position"],
  teamAbbreviation?: string,
): FantasyProsAdvisoryCandidate => ({
  name,
  normalizedPlayerName: name.toLowerCase(),
  position,
  ...(teamAbbreviation === undefined ? {} : { teamAbbreviation }),
});

describe("FantasyPros draft advisory", () => {
  it("carries rank, tier, and bye week across for a matched player", () => {
    const advisory = buildFantasyProsDraftAdvisory({
      basis: "ros",
      rankings: [ranking({
        playerId: 1,
        playerName: "Puka Nacua",
        position: "WR",
        rankEcr: 3,
        tier: 1,
        positionRank: "WR2",
      })],
      candidates: [candidate("Puka Nacua", "WR")],
    });

    expect(advisory).toEqual({
      basis: "ros",
      week: 3,
      players: [{
        normalizedPlayerName: "puka nacua",
        rankEcr: 3,
        tier: 1,
        positionRank: "WR2",
        momentum: "steady",
        ecrDelta: undefined,
      }],
    });
  });

  it("reads a positive delta as rising and a negative delta as falling", () => {
    const advisory = buildFantasyProsDraftAdvisory({
      basis: "ros",
      rankings: [
        ranking({ playerId: 1, playerName: "Brock Bowers", position: "TE", rankEcr: 17, ecrDelta: 1 }),
        ranking({ playerId: 2, playerName: "Trey McBride", position: "TE", rankEcr: 20, ecrDelta: -1 }),
        ranking({ playerId: 3, playerName: "Zach Ertz", position: "TE", rankEcr: 440, ecrDelta: 0 }),
      ],
      candidates: [
        candidate("Brock Bowers", "TE"),
        candidate("Trey McBride", "TE"),
        candidate("Zach Ertz", "TE"),
      ],
    });

    expect(advisory.players.map(player => player.momentum)).toEqual([
      "rising",
      "falling",
      "steady",
    ]);
  });

  it("omits a candidate FantasyPros does not rank", () => {
    const advisory = buildFantasyProsDraftAdvisory({
      basis: "ros",
      rankings: [ranking({ playerId: 1, playerName: "Puka Nacua", position: "WR", rankEcr: 3 })],
      candidates: [candidate("Puka Nacua", "WR"), candidate("Undrafted Rookie", "WR")],
    });

    expect(advisory.players.map(player => player.normalizedPlayerName)).toEqual(["puka nacua"]);
  });

  it("matches a defense on its team rather than its name", () => {
    const advisory = buildFantasyProsDraftAdvisory({
      basis: "ros",
      rankings: [ranking({
        playerId: 9,
        playerName: "Philadelphia Eagles",
        position: "DST",
        teamAbbreviation: "PHI",
        rankEcr: 120,
      })],
      candidates: [candidate("Eagles D/ST", "DST", "PHI")],
    });

    expect(advisory.players).toEqual([{
      normalizedPlayerName: "eagles d/st",
      rankEcr: 120,
      tier: undefined,
      positionRank: undefined,
      momentum: "steady",
      ecrDelta: undefined,
    }]);
  });

  it("leaves an unresolvable same-name collision unmatched", () => {
    const advisory = buildFantasyProsDraftAdvisory({
      basis: "ros",
      rankings: [
        ranking({ playerId: 1, playerName: "Michael Carter", position: "RB", teamAbbreviation: "ARI", rankEcr: 200 }),
        ranking({ playerId: 2, playerName: "Michael Carter", position: "RB", teamAbbreviation: "NYJ", rankEcr: 210 }),
      ],
      candidates: [candidate("Michael Carter", "RB")],
    });

    expect(advisory.players).toEqual([]);
  });

  it("reports the weekly basis and its week when built from weekly rankings", () => {
    const advisory = buildFantasyProsDraftAdvisory({
      basis: "weekly",
      rankings: [ranking({
        rankingType: "weekly",
        week: 7,
        playerId: 1,
        playerName: "Jahmyr Gibbs",
        position: "RB",
        rankEcr: 2,
      })],
      candidates: [candidate("Jahmyr Gibbs", "RB")],
    });

    expect(advisory.basis).toBe("weekly");
    expect(advisory.week).toBe(7);
  });

  it("serves nothing at all when no rankings are stored", () => {
    const advisory = buildFantasyProsDraftAdvisory({
      basis: "ros",
      rankings: [],
      candidates: [candidate("Puka Nacua", "WR")],
    });

    expect(advisory).toEqual({ basis: "ros", week: undefined, players: [] });
  });
});
