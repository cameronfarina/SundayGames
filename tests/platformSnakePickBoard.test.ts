import { describe, expect, it } from "vitest";
import type { LeagueSeason, SnakeLeagueSeason } from "../src/platform/leagueSeason.js";
import { emptyPicksFor, snakePicksFor } from "../src/platform/liveDraftRooms/snakePicks.js";
import { publishedSnakeSeason } from "./platformLiveDraftRooms/fixtures.js";

const snakeSeasonWith = (rounds: number, reversal: "standard" | "third-round"): SnakeLeagueSeason => {
  const season: LeagueSeason = publishedSnakeSeason();
  if (season.settings.draftFormat !== "snake") throw new Error("Expected a snake fixture.");
  return { ...season, settings: { ...season.settings, snake: { ...season.settings.snake, rounds, reversal } } };
};

const orderOf = (season: SnakeLeagueSeason, round: number): readonly string[] =>
  emptyPicksFor(season).filter(pick => pick.round === round).map(pick => pick.ownerDisplayName);

describe("snake pick board", () => {
  it("reverses every other round so the last team picks back to back", () => {
    const season = snakeSeasonWith(2, "standard");
    const first = orderOf(season, 1);

    expect(orderOf(season, 2)).toEqual([...first].reverse());
    expect(emptyPicksFor(season).map(pick => pick.overall)).toEqual(
      emptyPicksFor(season).map((_pick, index) => index + 1),
    );
  });

  it("keeps round two in reverse and round three the same under third-round reversal", () => {
    const season = snakeSeasonWith(4, "third-round");
    const first = orderOf(season, 1);

    expect(orderOf(season, 2)).toEqual([...first].reverse());
    expect(orderOf(season, 3)).toEqual([...first].reverse());
    expect(orderOf(season, 4)).toEqual(first);
  });

  it("seats a keeper on its own round and hands the next open slot to the first sale", () => {
    const season = snakeSeasonWith(2, "standard");
    const firstPick = emptyPicksFor(season)[0];
    if (firstPick === undefined) throw new Error("Expected a first pick.");

    const picks = snakePicksFor(
      season,
      [{
        teamId: firstPick.teamId,
        playerName: "Kept Player",
        position: "RB",
        price: 0,
        keeperRound: 1,
        source: "keeper",
      }],
      [{
        saleEventId: "sale-1",
        input: "sale",
        teamId: firstPick.teamId,
        ownerId: "owner",
        ownerDisplayName: firstPick.ownerDisplayName,
        teamDisplayName: firstPick.teamDisplayName,
        playerName: "Drafted Player",
        normalizedPlayerName: "drafted player",
        position: "WR",
        price: 0,
        expectedPrice: 0,
      }],
    );

    expect(picks[0]).toMatchObject({ playerName: "Kept Player", source: "keeper", round: 1 });
    expect(picks[1]).toMatchObject({ playerName: "Drafted Player", source: "sale", saleEventId: "sale-1" });
    expect(picks[2]?.playerName).toBeUndefined();
  });
});
