import {
  normalizedString,
  positiveInteger,
  requiredObject,
  type JsonObject,
} from "./json.js";
import {
  espnPickOrderFor,
  teamsInEspnDraftOrder,
} from "../../data/leagueSyncProviderAdapters/espnDraftOrder.js";
import type { EspnLeagueSettingsReviewTeam } from "./types.js";

export const pickOrderFor = (draftSettings: JsonObject): string[] =>
  espnPickOrderFor(draftSettings);

const displayNameFor = (team: JsonObject): string => {
  const name = normalizedString(team.name);
  if (name !== null) return name;

  const location = normalizedString(team.location);
  const nickname = normalizedString(team.nickname);
  const parts = [location, nickname].filter((value): value is string => value !== null);
  const displayName = parts.join(" ");
  return displayName.length > 0 ? displayName : `ESPN Team ${String(team.id)}`;
};

export const teamsFor = (
  body: JsonObject,
  pickOrder: readonly string[],
): EspnLeagueSettingsReviewTeam[] => {
  if (!Array.isArray(body.teams)) throw new Error("ESPN response is missing teams.");

  const positions = new Map(pickOrder.map((teamId, index) => [teamId, index + 1]));
  const teams = body.teams.map((value): EspnLeagueSettingsReviewTeam => {
    const team = requiredObject(value, "teams[]");
    const externalTeamId = String(positiveInteger(team.id) ?? "");
    if (externalTeamId.length === 0) throw new Error("ESPN response contains a team without an id.");
    return {
      externalTeamId,
      displayName: displayNameFor(team),
      abbreviation: normalizedString(team.abbrev),
      draftOrderPosition: positions.get(externalTeamId) ?? null,
    };
  });

  return teamsInEspnDraftOrder(teams, pickOrder, team => team.externalTeamId);
};
