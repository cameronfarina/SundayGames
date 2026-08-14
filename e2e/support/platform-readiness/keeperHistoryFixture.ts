import { leagueConfig } from "../../../config/league.js";
import { buildCurrentMockdLeagueSeason, type LeagueSeason } from "../../../src/platform/leagueSeason.js";

export const buildKeeperHistorySeason = (): LeagueSeason => {
  const owners = ["Owner11", "Sam", "Owner04", "Alex"];
  const baseSeason = buildCurrentMockdLeagueSeason(owners, { ...leagueConfig, teams: owners.length }, {
    leagueName: "Keeper history E2E",
    setupStatus: "draft",
  });
  const leagueId = `${baseSeason.leagueId}-keeper-history`;
  const seasonId = `${leagueId}-season-${baseSeason.seasonYear}`;

  return {
    ...baseSeason,
    id: seasonId,
    leagueId,
    league: {
      ...baseSeason.league,
      id: leagueId,
      externalLeagueId: `${baseSeason.league.externalLeagueId}-keeper-history`,
    },
    teams: baseSeason.teams.map((team, index) => ({
      ...team,
      id: `${seasonId}-team-${index + 1}`,
      leagueSeasonId: seasonId,
      ownerId: `${team.ownerId}-keeper-history`,
    })),
  };
};

export const wideDraft = (camPrice: number, samPrice: number): string => [
  "Team,Owner11,,,Sam,,,Owner04,,,Alex,,",
  `1,$${camPrice},RB,De'Von Achane,$${samPrice},WR,CeeDee Lamb,$32,WR,Puka Nacua,$72,RB,Jahmyr Gibbs`,
  "2,$61,WR,Ja'Marr Chase,$9,QB,Trevor Lawrence,$68,RB,Bijan Robinson,$67,WR,Amon-Ra St. Brown",
].join("\n");
