import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import type { FantasyProsStoredPlayer } from "../fantasyPros.js";
import type {
  BuildFantasyProsPlayerIndexInput,
  FantasyProsMatch,
  FantasyProsMatchCandidate,
  FantasyProsPlayerIndex,
} from "./contracts.js";
import {
  freeAgentTeamAbbreviation,
  normalizeTeamAbbreviation,
} from "./teamAbbreviations.js";

// "Texans D/ST" and "Houston Texans" have to meet somewhere, and the shared
// token is the nickname. Stripping the defense suffix leaves it at the end.
const defenseSuffixPattern = /\s+(?:d st|dst|def|defense)$/u;

const nicknameKey = (name: string): string | undefined => {
  const stripped = canonicalPlayerIdentityKey(name).replace(defenseSuffixPattern, "");
  const tokens = stripped.split(" ").filter(token => token.length > 0);
  return tokens[tokens.length - 1];
};

const playerKey = (name: string, position: string): string =>
  `${canonicalPlayerIdentityKey(name)}\0${position}`;

const pushTo = <TKey>(
  buckets: Map<TKey, FantasyProsStoredPlayer[]>,
  key: TKey,
  player: FantasyProsStoredPlayer,
): void => {
  const bucket = buckets.get(key);
  if (bucket === undefined) buckets.set(key, [player]);
  else bucket.push(player);
};

const resolve = (
  bucket: readonly FantasyProsStoredPlayer[],
  team: string | undefined,
): FantasyProsStoredPlayer | undefined => {
  const [only] = bucket;
  if (bucket.length <= 1) return only;
  if (team !== undefined) {
    const onTeam = bucket.filter(player =>
      normalizeTeamAbbreviation(player.teamAbbreviation) === team);
    if (onTeam.length === 1) return onTeam[0];
    if (onTeam.length > 1) return undefined;
  }
  // A duplicated name where only one player holds an NFL roster spot resolves
  // to the rostered one; anything still ambiguous stays unmatched.
  const rostered = bucket.filter(player => {
    const playerTeam = normalizeTeamAbbreviation(player.teamAbbreviation);
    return playerTeam !== undefined && playerTeam !== freeAgentTeamAbbreviation;
  });
  return rostered.length === 1 ? rostered[0] : undefined;
};

export const buildFantasyProsPlayerIndex = (
  input: BuildFantasyProsPlayerIndexInput,
): FantasyProsPlayerIndex => {
  const byNameAndPosition = new Map<string, FantasyProsStoredPlayer[]>();
  const defenseByTeam = new Map<string, FantasyProsStoredPlayer>();
  const defenseByNickname = new Map<string, FantasyProsStoredPlayer[]>();

  for (const player of input.players) {
    pushTo(byNameAndPosition, playerKey(player.playerName, player.position), player);
    if (player.position !== "DST") continue;
    const team = normalizeTeamAbbreviation(player.teamAbbreviation);
    if (team !== undefined) defenseByTeam.set(team, player);
    const nickname = nicknameKey(player.playerName);
    if (nickname !== undefined) pushTo(defenseByNickname, nickname, player);
  }

  const rankingByPlayerId = new Map((input.rankings ?? []).map(ranking => [ranking.playerId, ranking]));
  const projectionByPlayerId = new Map(
    (input.projections ?? []).map(projection => [projection.playerId, projection]),
  );

  const matched = (player: FantasyProsStoredPlayer): FantasyProsMatch => ({
    playerId: player.playerId,
    playerName: player.playerName,
    position: player.position,
    teamAbbreviation: player.teamAbbreviation,
    ranking: rankingByPlayerId.get(player.playerId),
    projection: projectionByPlayerId.get(player.playerId),
  });

  const findDefense = (
    candidate: FantasyProsMatchCandidate,
  ): FantasyProsStoredPlayer | undefined => {
    // FantasyPros models a defense as the team itself, so the abbreviation is
    // the only identifier both sides reliably agree on.
    const team = normalizeTeamAbbreviation(candidate.teamAbbreviation);
    const byTeam = team === undefined ? undefined : defenseByTeam.get(team);
    if (byTeam !== undefined) return byTeam;
    const nickname = nicknameKey(candidate.name);
    const bucket = nickname === undefined ? undefined : defenseByNickname.get(nickname);
    return bucket?.length === 1 ? bucket[0] : undefined;
  };

  return {
    find: candidate => {
      const player = candidate.position === "DST"
        ? findDefense(candidate)
        : resolve(
          byNameAndPosition.get(playerKey(candidate.name, candidate.position)) ?? [],
          normalizeTeamAbbreviation(candidate.teamAbbreviation),
        );
      return player === undefined ? undefined : matched(player);
    },
  };
};
