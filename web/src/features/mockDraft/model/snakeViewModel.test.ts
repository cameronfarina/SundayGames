import { describe, expect, it } from "vitest";
import { snakeMockResponseFixture } from "../test/snakeMockResponseFixture.js";
import {
  filterSnakePlayers,
  pickLabel,
  playerNamesById,
  snakeRounds,
  snakeTeamCanRoster,
} from "./snakeViewModel.js";

const { state } = snakeMockResponseFixture();
const players = state.board.players;

describe("snakeViewModel", () => {
  it("keeps only available players that match the search and position", () => {
    expect(filterSnakePlayers(players, "chase", "ALL").map(player => player.id)).toEqual(["chase"]);
    expect(filterSnakePlayers(players, "", "RB").map(player => player.id)).toEqual(["gibbs"]);
    expect(filterSnakePlayers(players, "", "QB")).toEqual([]);
  });

  it("matches on the NFL team and skips a player already drafted", () => {
    const [first] = players;
    if (first === undefined) throw new Error("Expected a fixture player.");
    expect(filterSnakePlayers([{ ...first, teamAbbreviation: undefined }], "det", "ALL")).toEqual([]);
    expect(filterSnakePlayers(players, "det", "ALL")).toHaveLength(2);
    expect(filterSnakePlayers([{ ...first, available: false }], "", "ALL")).toEqual([]);
  });

  it("drops a player once no open slot accepts the position", () => {
    const emptyTeam = state.teams.find(team => team.id === "team-owner11");
    const fullTeam = state.teams.find(team => team.id === "team-owner04");
    expect(snakeTeamCanRoster(emptyTeam, "RB")).toBe(true);
    expect(snakeTeamCanRoster(fullTeam, "RB")).toBe(false);
    expect(snakeTeamCanRoster(undefined, "RB")).toBe(false);
  });

  it("groups picks by round in pick order", () => {
    const rounds = snakeRounds(state.board.picks);
    expect(rounds.map(round => round.round)).toEqual([1, 2]);
    expect(rounds[0]?.picks.map(pick => pick.pickInRound)).toEqual([1, 2]);
  });

  it("writes a pick the way managers say it", () => {
    const first = state.board.picks[0];
    if (first === undefined) throw new Error("Expected a fixture pick.");
    expect(pickLabel(first)).toBe("1.01");
  });

  it("looks up a drafted player name by id", () => {
    expect(playerNamesById(players).get("gibbs")).toBe("Jahmyr Gibbs");
  });
});
