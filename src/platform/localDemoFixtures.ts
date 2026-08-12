import { nflTeamByEspnProTeamId } from "../../config/nflTeams.js";
import { keepers } from "../../config/keepers.js";
import { canonicalPlayerIdentityKey } from "../data/normalizePlayerName.js";
import { loadEspnWeeksOneToFour } from "../projections.js";
import type { LeagueSeason } from "./leagueSeason.js";
import type {
  LiveDraftRoomInitialRosterPlayer,
  LiveDraftRoomPlayerCatalogEntry,
} from "./liveDraftRooms.js";

type LocalDemoRankedPlayer = Omit<LiveDraftRoomPlayerCatalogEntry, "expectedPrice">;

export const localDemoEmail = "cam@mockd.local";
export const localDemoPassword = "mockd local e2e password";
export const localDemoSeasonId = "league-214674-season-2026";
export const localDemoRoomId = "room_mockd_e2e_2026";

const localDemoProjectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";
const localDemoCatalogLimit = 500;

const localDemoRankedPlayers = [
  { name: "Jahmyr Gibbs", position: "RB", teamAbbreviation: "DET", byeWeek: 6 },
  { name: "Bijan Robinson", position: "RB", teamAbbreviation: "ATL", byeWeek: 11 },
  { name: "Ja'Marr Chase", position: "WR", teamAbbreviation: "CIN", byeWeek: 6 },
  { name: "Puka Nacua", position: "WR", teamAbbreviation: "LAR", byeWeek: 11 },
  { name: "Jaxon Smith-Njigba", position: "WR", teamAbbreviation: "SEA", byeWeek: 11 },
  { name: "Christian McCaffrey", position: "RB", teamAbbreviation: "SF", byeWeek: 8 },
  { name: "Jonathan Taylor", position: "RB", teamAbbreviation: "IND", byeWeek: 13 },
  { name: "Amon-Ra St. Brown", position: "WR", teamAbbreviation: "DET", byeWeek: 6 },
  { name: "CeeDee Lamb", position: "WR", teamAbbreviation: "DAL", byeWeek: 14 },
  { name: "James Cook", position: "RB", teamAbbreviation: "BUF", byeWeek: 7 },
  { name: "Justin Jefferson", position: "WR", teamAbbreviation: "MIN", byeWeek: 6 },
  { name: "Ashton Jeanty", position: "RB", teamAbbreviation: "LV", byeWeek: 13 },
  { name: "Drake London", position: "WR", teamAbbreviation: "ATL", byeWeek: 11 },
  { name: "De'Von Achane", position: "RB", teamAbbreviation: "MIA", byeWeek: 6 },
  { name: "Saquon Barkley", position: "RB", teamAbbreviation: "PHI", byeWeek: 10 },
  { name: "Omarion Hampton", position: "RB", teamAbbreviation: "LAC", byeWeek: 7 },
  { name: "Chase Brown", position: "RB", teamAbbreviation: "CIN", byeWeek: 6 },
  { name: "Kenneth Walker", position: "RB", teamAbbreviation: "KC", byeWeek: 5 },
  { name: "Trey McBride", position: "TE", teamAbbreviation: "ARI", byeWeek: 14 },
  { name: "Brock Bowers", position: "TE", teamAbbreviation: "LV", byeWeek: 13 },
  { name: "Nico Collins", position: "WR", teamAbbreviation: "HOU", byeWeek: 8 },
  { name: "Jeremiyah Love", position: "RB", teamAbbreviation: "ARI", byeWeek: 14 },
  { name: "Derrick Henry", position: "RB", teamAbbreviation: "BAL", byeWeek: 13 },
  { name: "A.J. Brown", position: "WR", teamAbbreviation: "NE", byeWeek: 11 },
  { name: "Rashee Rice", position: "WR", teamAbbreviation: "KC", byeWeek: 5 },
  { name: "George Pickens", position: "WR", teamAbbreviation: "DAL", byeWeek: 14 },
  { name: "Josh Jacobs", position: "RB", teamAbbreviation: "GB", byeWeek: 11 },
  { name: "Chris Olave", position: "WR", teamAbbreviation: "NO", byeWeek: 8 },
  { name: "Josh Allen", position: "QB", teamAbbreviation: "BUF", byeWeek: 7 },
  { name: "DeVonta Smith", position: "WR", teamAbbreviation: "PHI", byeWeek: 10 },
  { name: "Breece Hall", position: "RB", teamAbbreviation: "NYJ", byeWeek: 13 },
  { name: "Kyren Williams", position: "RB", teamAbbreviation: "LAR", byeWeek: 11 },
  { name: "Javonte Williams", position: "RB", teamAbbreviation: "DAL", byeWeek: 14 },
  { name: "Garrett Wilson", position: "WR", teamAbbreviation: "NYJ", byeWeek: 13 },
  { name: "Tetairoa McMillan", position: "WR", teamAbbreviation: "CAR", byeWeek: 5 },
  { name: "Tee Higgins", position: "WR", teamAbbreviation: "CIN", byeWeek: 6 },
  { name: "Zay Flowers", position: "WR", teamAbbreviation: "BAL", byeWeek: 13 },
  { name: "Malik Nabers", position: "WR", teamAbbreviation: "NYG", byeWeek: 8 },
  { name: "Cam Skattebo", position: "RB", teamAbbreviation: "NYG", byeWeek: 8 },
  { name: "Travis Etienne", position: "RB", teamAbbreviation: "NO", byeWeek: 8 },
  { name: "Jaylen Waddle", position: "WR", teamAbbreviation: "DEN", byeWeek: 10 },
  { name: "Emeka Egbuka", position: "WR", teamAbbreviation: "TB", byeWeek: 10 },
  { name: "Ladd McConkey", position: "WR", teamAbbreviation: "LAC", byeWeek: 7 },
  { name: "Colston Loveland", position: "TE", teamAbbreviation: "CHI", byeWeek: 10 },
  { name: "Lamar Jackson", position: "QB", teamAbbreviation: "BAL", byeWeek: 13 },
  { name: "Terry McLaurin", position: "WR", teamAbbreviation: "WAS", byeWeek: 7 },
  { name: "Quinshon Judkins", position: "RB", teamAbbreviation: "CLE", byeWeek: 11 },
  { name: "Bucky Irving", position: "RB", teamAbbreviation: "TB", byeWeek: 10 },
  { name: "Luther Burden", position: "WR", teamAbbreviation: "CHI", byeWeek: 10 },
  { name: "Davante Adams", position: "WR", teamAbbreviation: "LAR", byeWeek: 11 },
  { name: "Jameson Williams", position: "WR", teamAbbreviation: "DET", byeWeek: 6 },
  { name: "Tyler Warren", position: "TE", teamAbbreviation: "IND", byeWeek: 13 },
  { name: "TreVeyon Henderson", position: "RB", teamAbbreviation: "NE", byeWeek: 11 },
  { name: "DJ Moore", position: "WR", teamAbbreviation: "BUF", byeWeek: 7 },
  { name: "D'Andre Swift", position: "RB", teamAbbreviation: "CHI", byeWeek: 10 },
  { name: "Rome Odunze", position: "WR", teamAbbreviation: "CHI", byeWeek: 10 },
  { name: "David Montgomery", position: "RB", teamAbbreviation: "HOU", byeWeek: 8 },
  { name: "Drake Maye", position: "QB", teamAbbreviation: "NE", byeWeek: 11 },
  { name: "Jayden Daniels", position: "QB", teamAbbreviation: "WAS", byeWeek: 7 },
  { name: "Bhayshul Tuten", position: "RB", teamAbbreviation: "JAC", byeWeek: 7 },
  { name: "Carnell Tate", position: "WR", teamAbbreviation: "TEN", byeWeek: 9 },
  { name: "Joe Burrow", position: "QB", teamAbbreviation: "CIN", byeWeek: 6 },
  { name: "Christian Watson", position: "WR", teamAbbreviation: "GB", byeWeek: 11 },
  { name: "Jalen Hurts", position: "QB", teamAbbreviation: "PHI", byeWeek: 10 },
  { name: "Jadarian Price", position: "RB", teamAbbreviation: "SEA", byeWeek: 11 },
  { name: "Mike Evans", position: "WR", teamAbbreviation: "SF", byeWeek: 8 },
  { name: "Brian Thomas", position: "WR", teamAbbreviation: "JAC", byeWeek: 7 },
  { name: "Marvin Harrison", position: "WR", teamAbbreviation: "ARI", byeWeek: 14 },
  { name: "Tony Pollard", position: "RB", teamAbbreviation: "TEN", byeWeek: 9 },
  { name: "Jordyn Tyson", position: "WR", teamAbbreviation: "NO", byeWeek: 8 },
  { name: "Harold Fannin", position: "TE", teamAbbreviation: "CLE", byeWeek: 11 },
  { name: "Alec Pierce", position: "WR", teamAbbreviation: "IND", byeWeek: 13 },
  { name: "DK Metcalf", position: "WR", teamAbbreviation: "PIT", byeWeek: 9 },
  { name: "Kyle Pitts", position: "TE", teamAbbreviation: "ATL", byeWeek: 11 },
  { name: "Sam LaPorta", position: "TE", teamAbbreviation: "DET", byeWeek: 6 },
  { name: "Parker Washington", position: "WR", teamAbbreviation: "JAC", byeWeek: 7 },
  { name: "Jaylen Warren", position: "RB", teamAbbreviation: "PIT", byeWeek: 9 },
  { name: "Courtland Sutton", position: "WR", teamAbbreviation: "DEN", byeWeek: 10 },
  { name: "Tucker Kraft", position: "TE", teamAbbreviation: "GB", byeWeek: 11 },
  { name: "Caleb Williams", position: "QB", teamAbbreviation: "CHI", byeWeek: 10 },
] as const satisfies readonly LocalDemoRankedPlayer[];

const expectedPriceForRank = (rank: number): number =>
  Math.max(1, Math.round(74 * Math.exp(-(rank - 1) / 34)));

export const localDemoPlayerCatalog = localDemoRankedPlayers.map((player, index) => ({
  ...player,
  expectedPrice: expectedPriceForRank(index + 1),
})) satisfies readonly LiveDraftRoomPlayerCatalogEntry[];

export const loadCurrentPlayerCatalog = async (): Promise<readonly LiveDraftRoomPlayerCatalogEntry[]> => {
  const projections = await loadEspnWeeksOneToFour(localDemoProjectionPath);
  const projectionsByIdentity = new Map(
    projections.map(projection => [canonicalPlayerIdentityKey(projection.name), projection]),
  );
  const projectionFields = (projection: (typeof projections)[number] | undefined) => projection === undefined
    ? {}
    : {
        week1Projection: projection.weeks[1] ?? 0,
        weeks1To4Projection: projection.weeks1To4,
        ...(projection.seasonProjection === undefined ? {} : { seasonProjection: projection.seasonProjection }),
      };
  const catalog: LiveDraftRoomPlayerCatalogEntry[] = localDemoPlayerCatalog.map(player => ({
    ...player,
    ...projectionFields(projectionsByIdentity.get(canonicalPlayerIdentityKey(player.name))),
  }));
  const includedPlayerIdentities = new Set(catalog.map(player => canonicalPlayerIdentityKey(player.name)));
  const rankedProjections = [...projections].sort((left, right) =>
    (left.espnRank ?? Number.MAX_SAFE_INTEGER) - (right.espnRank ?? Number.MAX_SAFE_INTEGER)
    || (right.espnAuctionValue ?? 0) - (left.espnAuctionValue ?? 0)
    || (right.seasonProjection ?? 0) - (left.seasonProjection ?? 0)
    || left.name.localeCompare(right.name)
  );

  for (const projection of rankedProjections) {
    if (catalog.length >= localDemoCatalogLimit) break;
    const playerIdentity = canonicalPlayerIdentityKey(projection.name);
    if (!playerIdentity || includedPlayerIdentities.has(playerIdentity)) continue;

    const team = projection.proTeamId === undefined
      ? undefined
      : nflTeamByEspnProTeamId[projection.proTeamId];
    catalog.push({
      name: projection.name,
      position: projection.position,
      expectedPrice: Math.max(1, Math.round(projection.espnAuctionValue ?? expectedPriceForRank(catalog.length + 1))),
      ...projectionFields(projection),
      ...(team === undefined ? {} : { teamAbbreviation: team.abbreviation, byeWeek: team.byeWeek }),
    });
    includedPlayerIdentities.add(playerIdentity);
  }

  return catalog;
};

export const loadLocalDemoPlayerCatalog = loadCurrentPlayerCatalog;

export const currentLeagueInitialRostersFor = (
  season: LeagueSeason,
): readonly LiveDraftRoomInitialRosterPlayer[] =>
  keepers.flatMap(keeper => {
    const team = season.teams.find(candidate => candidate.ownerDisplayName === keeper.owner);
    if (team === undefined) return [];

    return [{
      teamId: team.id,
      playerName: keeper.player,
      position: keeper.position,
      price: keeper.newCost,
      source: "keeper" as const,
    }];
  });
