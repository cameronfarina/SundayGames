import { describe, expect, it } from "vitest";
import { leagueConnectionDetailSchema } from "./leagueConnectionsSchema";
import { connectionDetailFixture } from "./leagueDetail.fixture";

describe("league detail fixture", () => {
  it("covers a full roster, an empty team, a played game, and a bye", () => {
    const detail = leagueConnectionDetailSchema.parse(connectionDetailFixture);

    expect(detail.league?.teams.map(team => team.players.length)).toEqual([2, 0]);
    expect(detail.league?.matchups.map(matchup => matchup.awayTeamId)).toEqual(["2", undefined]);
  });
});
