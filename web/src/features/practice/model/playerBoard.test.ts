import { describe, expect, it } from "vitest";
import {
  filterAndSortPlayers,
  playerMarketValue,
  playerMyValue,
  positionTone,
} from "./playerBoard";
import type { PracticePlayer } from "../api/playerCatalogSchema";

const chaseBrown: PracticePlayer = {
    byeWeek: 6,
    expectedPrice: 55,
    isKeeper: true,
    keeperPrice: 17,
    marketPrice: 46,
    myValue: 51,
    name: "Chase Brown",
    position: "RB",
    teamAbbreviation: "CIN",
  };
const jamarrChase: PracticePlayer = {
    expectedPrice: 58,
    marketRank: 1,
    name: "Ja'Marr Chase",
    position: "WR",
    teamAbbreviation: "CIN",
  };
const jaredGoff: PracticePlayer = {
    expectedPrice: 7,
    leagueRank: 12,
    name: "Jared Goff",
    position: "QB",
    teamAbbreviation: "DET",
  };
const players: readonly PracticePlayer[] = [chaseBrown, jamarrChase, jaredGoff];

describe("Practice player board model", () => {
  it("uses personalized prices before baseline prices", () => {
    expect(playerMarketValue(chaseBrown)).toBe(46);
    expect(playerMyValue(chaseBrown)).toBe(51);
    expect(playerMarketValue(jamarrChase)).toBe(58);
    expect(playerMyValue(jamarrChase)).toBe(58);
    expect(playerMyValue({ expectedPrice: 8, leagueValue: 10, name: "League value", position: "TE" })).toBe(10);
  });

  it("filters across identity fields and shortlist membership", () => {
    expect(filterAndSortPlayers(players, {
      position: "WR",
      search: "cin",
      shortlistOnly: false,
      sort: "market",
    }, new Set()).map(player => player.name)).toEqual(["Ja'Marr Chase"]);
    expect(filterAndSortPlayers(players, {
      position: "ALL",
      search: "",
      shortlistOnly: true,
      sort: "market",
    }, new Set(["jared goff"])).map(player => player.name)).toEqual(["Jared Goff"]);
    expect(filterAndSortPlayers(players, {
      position: "ALL", search: "qb", shortlistOnly: false, sort: "market",
    }, new Set()).map(player => player.name)).toEqual(["Jared Goff"]);
    expect(filterAndSortPlayers(players, {
      position: "ALL", search: "det", shortlistOnly: false, sort: "market",
    }, new Set()).map(player => player.name)).toEqual(["Jared Goff"]);
    expect(filterAndSortPlayers(players, {
      position: "ALL", search: "missing", shortlistOnly: false, sort: "market",
    }, new Set())).toEqual([]);
  });

  it("sorts value modes descending and rank mode ascending", () => {
    expect(filterAndSortPlayers(players, {
      position: "ALL",
      search: "",
      shortlistOnly: false,
      sort: "mine",
    }, new Set()).map(player => player.name)).toEqual([
      "Ja'Marr Chase",
      "Chase Brown",
      "Jared Goff",
    ]);
    expect(filterAndSortPlayers([
      { expectedPrice: 1, name: "Zulu", position: "K" },
      { expectedPrice: 1, name: "Alpha", position: "K" },
    ], {
      position: "ALL", search: "", shortlistOnly: false, sort: "market",
    }, new Set()).map(player => player.name)).toEqual(["Alpha", "Zulu"]);
    expect(filterAndSortPlayers(players, {
      position: "ALL",
      search: "",
      shortlistOnly: false,
      sort: "rank",
    }, new Set()).map(player => player.name)).toEqual([
      "Ja'Marr Chase",
      "Jared Goff",
      "Chase Brown",
    ]);
  });

  it("provides stable visual tones for every position family", () => {
    expect(["QB", "RB", "WR", "TE", "FLEX", "DST", "K", "OTHER"].map(positionTone))
      .toEqual(["gold", "blue", "purple", "pink", "green", "aqua", "neutral", "neutral"]);
  });
});
