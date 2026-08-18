import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseFantasyProsPlayers,
  parseFantasyProsRankings,
} from "../src/data/fantasyPros.js";
import type { FantasyProsStoredPlayer, FantasyProsStoredRanking } from "../src/platform/fantasyPros.js";
import {
  buildFantasyProsPlayerIndex,
  normalizeTeamAbbreviation,
} from "../src/platform/fantasyProsMatching.js";

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures/fantasyPros", name), "utf8"));

const fetchedAt = "2026-09-10T12:00:00.000Z";

const storedPlayers = (): readonly FantasyProsStoredPlayer[] =>
  parseFantasyProsPlayers(fixture("players.json"))
    .map(player => ({ ...player, fetchedAt }));

const storedRankings = (): readonly FantasyProsStoredRanking[] =>
  parseFantasyProsRankings(fixture("rankings-ros.json"), {
    type: "ros",
    scoring: "PPR",
    week: 0,
  }).rankings.map(ranking => ({
    ...ranking,
    rankingType: "ros" as const,
    scoring: "PPR" as const,
    week: 0,
    fetchedAt,
  }));

const index = () => buildFantasyProsPlayerIndex({
  players: storedPlayers(),
  rankings: storedRankings(),
});

describe("team abbreviation dialects", () => {
  it("folds the ESPN spellings onto the FantasyPros spellings", () => {
    expect(normalizeTeamAbbreviation("JAX")).toBe("JAC");
    expect(normalizeTeamAbbreviation("WSH")).toBe("WAS");
    expect(normalizeTeamAbbreviation("LA")).toBe("LAR");
    expect(normalizeTeamAbbreviation("lar")).toBe("LAR");
    expect(normalizeTeamAbbreviation("DET")).toBe("DET");
    expect(normalizeTeamAbbreviation(undefined)).toBeUndefined();
    expect(normalizeTeamAbbreviation("  ")).toBeUndefined();
  });
});

describe("FantasyPros player matching", () => {
  it("matches a catalog entry to its FantasyPros id and latest ranking", () => {
    const match = index().find({ name: "Jahmyr Gibbs", position: "RB", teamAbbreviation: "DET" });

    expect(match).toMatchObject({ playerId: 22968, playerName: "Jahmyr Gibbs", position: "RB" });
    expect(match?.ranking).toMatchObject({ rankingType: "ros", rankEcr: 2, positionRank: "RB1" });
  });

  it("matches through the alias table and the generational suffix strip", () => {
    const catalog = index();

    expect(catalog.find({ name: "Ja'Marr Chase", position: "WR" })?.playerName).toBe("Ja'Marr Chase");
    expect(catalog.find({ name: "JaMarr Chase", position: "WR" })?.playerName).toBe("Ja'Marr Chase");
  });

  it("refuses to match across positions", () => {
    expect(index().find({ name: "Jahmyr Gibbs", position: "WR" })).toBeUndefined();
  });

  it("returns nothing for a player the catalog does not carry", () => {
    expect(index().find({ name: "Nobody At All", position: "TE" })).toBeUndefined();
  });

  it("breaks a suffix collision with the team abbreviation", () => {
    const catalog = index();

    // "Jermaine Terry" and "Jermaine Terry II" collapse to the same identity
    // key once the suffix is stripped; only the team tells them apart.
    expect(catalog.find({ name: "Jermaine Terry", position: "TE", teamAbbreviation: "CLE" }))
      .toMatchObject({ playerId: 27857, playerName: "Jermaine Terry II" });
    expect(catalog.find({ name: "E.J. Williams", position: "WR", teamAbbreviation: "LV" }))
      .toMatchObject({ playerId: 28677, playerName: "E.J. Williams Jr." });
  });

  it("falls back to the rostered player when the catalog entry has no team", () => {
    expect(index().find({ name: "Jermaine Terry", position: "TE" }))
      .toMatchObject({ playerId: 27857, teamAbbreviation: "CLE" });
  });

  it("leaves a collision unmatched when both players are free agents", () => {
    // "LJ Johnson" and "LJ Johnson Jr." are both unsigned, so nothing
    // separates them and guessing would attach the wrong ranking.
    expect(index().find({ name: "LJ Johnson", position: "RB" })).toBeUndefined();
  });

  it("matches a defense by team abbreviation", () => {
    const match = index().find({ name: "Texans D/ST", position: "DST", teamAbbreviation: "HOU" });

    expect(match).toMatchObject({ playerId: 8120, playerName: "Houston Texans", position: "DST" });
    expect(match?.ranking).toMatchObject({ positionRank: "DST1" });
  });

  it("matches a defense whose catalog team uses the other dialect", () => {
    const catalog = index();

    expect(catalog.find({ name: "Jaguars D/ST", position: "DST", teamAbbreviation: "JAX" })
      ?.teamAbbreviation).toBe("JAC");
    expect(catalog.find({ name: "Commanders D/ST", position: "DST", teamAbbreviation: "WSH" })
      ?.teamAbbreviation).toBe("WAS");
    expect(catalog.find({ name: "Rams D/ST", position: "DST", teamAbbreviation: "LA" })
      ?.teamAbbreviation).toBe("LAR");
  });

  it("matches a defense by nickname when the catalog entry has no team", () => {
    expect(index().find({ name: "Texans D/ST", position: "DST" }))
      .toMatchObject({ playerId: 8120, playerName: "Houston Texans" });
    expect(index().find({ name: "Denver Broncos", position: "DST" })?.teamAbbreviation).toBe("DEN");
  });

  it("attaches the latest projection alongside the ranking", () => {
    const catalog = buildFantasyProsPlayerIndex({
      players: storedPlayers(),
      rankings: storedRankings(),
      projections: [{
        week: 0,
        playerId: 22968,
        playerName: "Jahmyr Gibbs",
        position: "RB",
        pointsPpr: 372.92,
        fetchedAt,
      }],
    });

    expect(catalog.find({ name: "Jahmyr Gibbs", position: "RB" })?.projection)
      .toMatchObject({ week: 0, pointsPpr: 372.92 });
  });

  it("still matches when no rankings or projections are stored yet", () => {
    const catalog = buildFantasyProsPlayerIndex({ players: storedPlayers() });
    const match = catalog.find({ name: "Jahmyr Gibbs", position: "RB" });

    expect(match?.playerId).toBe(22968);
    expect(match?.ranking).toBeUndefined();
    expect(match?.projection).toBeUndefined();
  });
});
