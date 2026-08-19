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

  it("seats a keeper on its own round and fills a native selection by overall pick", () => {
    const season = snakeSeasonWith(2, "standard");
    const empty = emptyPicksFor(season);
    const firstPick = empty[0];
    const secondPick = empty[1];
    if (firstPick === undefined || secondPick === undefined) throw new Error("Expected draft picks.");

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
        pickEventId: "pick-1",
        input: "Drafted Player",
        overall: secondPick.overall,
        round: secondPick.round,
        pickInRound: secondPick.pickInRound,
        teamId: secondPick.teamId,
        ownerId: "owner",
        ownerDisplayName: secondPick.ownerDisplayName,
        teamDisplayName: secondPick.teamDisplayName,
        playerName: "Drafted Player",
        normalizedPlayerName: "drafted player",
        position: "WR",
        expectedPrice: 0,
      }],
    );

    expect(picks[0]).toMatchObject({ playerName: "Kept Player", source: "keeper", round: 1 });
    expect(picks[1]).toMatchObject({ playerName: "Drafted Player", source: "pick", pickEventId: "pick-1" });
    expect(picks[2]?.playerName).toBeUndefined();
  });
});
