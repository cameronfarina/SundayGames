import type { SyncedMatchup } from "./contracts.js";
import { optionalText, pointsValue } from "./decode.js";

interface MatchupSide {
  points: number;
  teamId: string;
}

/**
 * Sleeper does not pair teams for you: two rows sharing a matchup_id are one
 * game. A row with no matchup_id is a team on a bye, which is still worth
 * showing, so it becomes a matchup with no away side.
 */
export const matchupsFor = (
  week: number,
  rows: readonly Record<string, unknown>[],
): readonly SyncedMatchup[] => {
  const sidesByMatchupId = new Map<string, MatchupSide[]>();
  const byes: MatchupSide[] = [];

  for (const row of rows) {
    const teamId = optionalText(row.roster_id);
    if (teamId === undefined) continue;
    const side: MatchupSide = { points: pointsValue(row.points), teamId };
    const matchupId = optionalText(row.matchup_id);
    if (matchupId === undefined) {
      byes.push(side);
      continue;
    }
    sidesByMatchupId.set(matchupId, [...sidesByMatchupId.get(matchupId) ?? [], side]);
  }

  const paired = [...sidesByMatchupId.entries()].flatMap(([matchupId, sides]) => {
    const [home, away] = sides;
    if (home === undefined) return [];
    return [{
      week,
      matchupKey: `${week}-${matchupId}`,
      homeTeamId: home.teamId,
      homePoints: home.points,
      ...(away === undefined ? {} : { awayTeamId: away.teamId, awayPoints: away.points }),
    }];
  });

  return [
    ...paired,
    ...byes.map(side => ({
      week,
      matchupKey: `${week}-bye-${side.teamId}`,
      homeTeamId: side.teamId,
      homePoints: side.points,
    })),
  ].sort((left, right) => left.matchupKey.localeCompare(right.matchupKey));
};
