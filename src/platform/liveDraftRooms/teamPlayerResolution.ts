import { cleanPlayerName } from "../../data/normalizePlayerName.js";
import type { FantasyTeam, LeagueSeason } from "../leagueSeason.js";
import type {
  LiveDraftRoomBoardPlayer,
  ParsedLiveDraftRoomSaleInput,
} from "./contracts/players.js";
import { searchKeyFor } from "./common.js";
import { LiveDraftRoomError } from "./error.js";

const teamLabelFor = (team: FantasyTeam): string =>
  `${team.ownerDisplayName} - ${team.displayName}`;

const teamKeyCandidates = (team: FantasyTeam): readonly string[] => [
  team.id,
  team.ownerId,
  team.ownerDisplayName,
  team.displayName,
  teamLabelFor(team),
];

const uniqueTeamMatch = (matches: readonly FantasyTeam[]): FantasyTeam | undefined =>
  matches.length === 1 ? matches[0] : undefined;

export const resolveTeam = (
  season: LeagueSeason,
  input: ParsedLiveDraftRoomSaleInput,
): FantasyTeam => {
  if (input.teamId !== undefined) {
    const team = season.teams.find(candidate => candidate.id === input.teamId);
    if (team === undefined) {
      throw new LiveDraftRoomError("team_not_found", `Unknown team "${input.teamId}".`);
    }
    if (input.ownerId !== undefined && team.ownerId !== input.ownerId) {
      throw new LiveDraftRoomError("team_not_found", `Sale team does not match owner "${input.ownerId}".`);
    }
    return team;
  }

  if (input.ownerId !== undefined) {
    const team = season.teams.find(candidate => candidate.ownerId === input.ownerId);
    if (team === undefined) {
      throw new LiveDraftRoomError("owner_not_found", `Unknown owner "${input.ownerId}".`);
    }
    return team;
  }

  const ownerText = input.ownerText ?? input.teamName;
  if (ownerText === undefined || ownerText.trim().length === 0) {
    throw new LiveDraftRoomError("owner_not_found", "Sale command must include an owner or team.");
  }

  const ownerKey = searchKeyFor(ownerText);
  const exactMatches = season.teams.filter(team =>
    teamKeyCandidates(team).some(candidate => searchKeyFor(candidate) === ownerKey)
  );
  const exactMatch = uniqueTeamMatch(exactMatches);
  if (exactMatch !== undefined) return exactMatch;
  if (exactMatches.length > 1) {
    throw new LiveDraftRoomError("owner_not_found", `Owner "${ownerText}" matches multiple teams.`);
  }

  const fuzzyMatches = season.teams.filter(team =>
    teamKeyCandidates(team).some(candidate => searchKeyFor(candidate).startsWith(ownerKey))
  );
  const fuzzyMatch = uniqueTeamMatch(fuzzyMatches);
  if (fuzzyMatch !== undefined) return fuzzyMatch;
  if (fuzzyMatches.length > 1) {
    throw new LiveDraftRoomError(
      "owner_not_found",
      `Owner or team "${ownerText}" matches multiple teams: ${fuzzyMatches.map(teamLabelFor).join(", ")}.`,
    );
  }
  throw new LiveDraftRoomError("owner_not_found", `Unknown owner or team "${ownerText}".`);
};

const playerMatchScore = (player: LiveDraftRoomBoardPlayer, playerText: string): number => {
  const query = searchKeyFor(playerText);
  const key = searchKeyFor(player.name);
  const tokens = key.split(" ");
  if (key === query) return 1_000;
  if (key.startsWith(`${query} `)) return 900;
  if (tokens.includes(query)) return 800;
  if (key.includes(query)) return 700;
  return 0;
};

export const resolvePlayer = (
  playerCatalog: readonly LiveDraftRoomBoardPlayer[],
  playerText: string,
): LiveDraftRoomBoardPlayer => {
  const cleaned = cleanPlayerName(playerText);
  const matches = playerCatalog
    .map(player => ({ player, score: playerMatchScore(player, cleaned) }))
    .filter(match => match.score > 0)
    .sort((left, right) =>
      right.score - left.score
      || right.player.expectedPrice - left.player.expectedPrice
      || left.player.name.localeCompare(right.player.name)
    );
  const best = matches[0];
  if (best === undefined) {
    throw new LiveDraftRoomError("player_not_found", `Unknown player "${cleaned}".`);
  }
  const second = matches[1];
  if (second !== undefined && second.score === best.score) {
    throw new LiveDraftRoomError(
      "player_not_found",
      `Ambiguous player "${cleaned}". Matches: ${matches.slice(0, 6).map(match => match.player.name).join(", ")}.`,
    );
  }
  return best.player;
};
