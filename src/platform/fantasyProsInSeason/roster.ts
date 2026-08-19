import type { Position } from "../../../config/league.js";
import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";

/**
 * Everything the FantasyPros match needs. The drafted roster carries the team
 * abbreviation and bye week already, and a defense only ever resolves through
 * its team, so neither can be dropped on the way through.
 */
export interface FantasyProsRosterCandidate {
  playerId: string;
  name: string;
  position: Position;
  teamAbbreviation?: string | undefined;
  byeWeek?: number | undefined;
}

interface RosterSourcePlayer {
  name: string;
  position: Position;
  teamAbbreviation?: string | undefined;
  byeWeek?: number | undefined;
}

/** The slice of a live draft room this module reads, and nothing more. */
export interface FantasyProsRosterSource {
  playerCatalog: readonly RosterSourcePlayer[];
  projection: {
    teams: readonly {
      teamId: string;
      ownerId: string;
      roster: readonly RosterSourcePlayer[];
    }[];
  };
}

export interface FantasyProsRosterView {
  players: readonly FantasyProsRosterCandidate[];
  freeAgents: readonly FantasyProsRosterCandidate[];
}

const candidateFor = (player: RosterSourcePlayer): FantasyProsRosterCandidate => ({
  playerId: `draft-player:${canonicalPlayerIdentityKey(player.name)}`,
  name: player.name,
  position: player.position,
  teamAbbreviation: player.teamAbbreviation,
  byeWeek: player.byeWeek,
});

/**
 * A roster is never stored as a row; it is replayed from the draft room. Free
 * agents are the league catalog minus every name drafted by any team, which is
 * the same derivation the post-draft analysis uses.
 */
export const fantasyProsRosterView = (
  room: FantasyProsRosterSource,
  teamId: string,
  ownerId: string,
): FantasyProsRosterView | undefined => {
  const team = room.projection.teams
    .find(candidate => candidate.teamId === teamId && candidate.ownerId === ownerId);
  if (team === undefined) return undefined;

  const drafted = new Set(
    room.projection.teams
      .flatMap(rosteredTeam => rosteredTeam.roster)
      .map(player => canonicalPlayerIdentityKey(player.name)),
  );

  return {
    players: team.roster.map(candidateFor),
    freeAgents: room.playerCatalog
      .filter(player => !drafted.has(canonicalPlayerIdentityKey(player.name)))
      .map(candidateFor),
  };
};
