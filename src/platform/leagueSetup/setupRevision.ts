import { createHash } from "node:crypto";
import type { LeagueSeason } from "../leagueSeason.js";

export class LeagueSetupWriteConflictError extends Error {
  constructor() {
    super("League setup changed after this review was created. Analyze the screenshot again.");
    this.name = "LeagueSetupWriteConflictError";
  }
}

export const leagueSeasonSetupRevision = (season: LeagueSeason): string =>
  createHash("sha256").update(JSON.stringify({
    id: season.id,
    league: season.league,
    settings: season.settings,
    setupStatus: season.setupStatus,
    teams: [...season.teams]
      .sort((left, right) => (
        left.draftOrderPosition - right.draftOrderPosition || left.id.localeCompare(right.id)
      ))
      .map(team => ({
        id: team.id,
        ownerId: team.ownerId,
        ownerDisplayName: team.ownerDisplayName,
        managerDisplayNames: team.managerDisplayNames ?? [],
        abbreviation: team.abbreviation ?? "",
        displayName: team.displayName,
        draftOrderPosition: team.draftOrderPosition,
      })),
  })).digest("base64url");
