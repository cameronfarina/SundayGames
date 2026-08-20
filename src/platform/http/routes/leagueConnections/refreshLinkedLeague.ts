import { createLeagueSeasonFromConfirmedSetup } from "../../../leagueCreation.js";
import type { LeagueSeason, LeagueSeasonSettings } from "../../../leagueSeason.js";
import type { LeagueConnection, StoredLeagueSnapshot } from "../../../leagueConnections.js";
import { confirmedSetupFromSyncedLeague } from "../../../leagueSyncImport.js";
import { leagueSeasonSetupRevision } from "../../../leagueSetup.js";
import type { PlatformApp } from "../../contracts.js";
import { existingTeamsForImport } from "./importTeamMapping.js";

interface RefreshLinkedLeagueInput {
  app: PlatformApp;
  connection: LeagueConnection;
  previousSnapshot: StoredLeagueSnapshot | null;
  sessionToken: string;
  snapshot: StoredLeagueSnapshot;
  targetSeasonId?: string;
  now: Date;
}

export type RefreshLinkedLeagueResult =
  | { status: "refreshed"; leagueId: string; seasonId: string }
  | { status: "needs_attention"; message: string };

const updatedSettings = (
  generated: LeagueSeason,
  teamIds: ReadonlyMap<string, string>,
): LeagueSeasonSettings => {
  const settings = generated.settings;
  if (settings.draftFormat !== "snake") return settings;
  return {
    ...settings,
    snake: {
      ...settings.snake,
      order: settings.snake.order.map(teamId => teamIds.get(teamId) ?? teamId),
    },
  };
};

const needsAttention = (message: string): RefreshLinkedLeagueResult => ({
  status: "needs_attention",
  message,
});

export const refreshLinkedLeague = async ({
  app,
  connection,
  previousSnapshot,
  sessionToken,
  snapshot,
  targetSeasonId,
  now,
}: RefreshLinkedLeagueInput): Promise<RefreshLinkedLeagueResult> => {
  const seasonId = targetSeasonId ?? connection.linkedSeasonId;
  if (seasonId === undefined) return needsAttention("The linked league is missing its season.");
  const existing = await app.leagueSetupRepository.findLeagueSeason(seasonId);
  if (existing === null) return needsAttention("The selected Sunday Games league no longer exists.");

  const setup = confirmedSetupFromSyncedLeague(connection, snapshot);
  if (setup.status === "needs_attention") return needsAttention(setup.message);
  const generated = createLeagueSeasonFromConfirmedSetup(setup.setup);
  if (generated.seasonYear !== existing.seasonYear) {
    return needsAttention("The selected Sunday Games league is for a different season.");
  }

  const memberships = await app.listLeagueMemberships(existing.leagueId);
  const mapping = existingTeamsForImport({
    existingTeams: existing.teams,
    generatedTeams: generated.teams,
    memberships,
    previousSnapshot,
    snapshot,
  });
  if (mapping.status === "needs_attention") return needsAttention(mapping.message);

  const generatedToExisting = new Map<string, string>();
  const teams = generated.teams.map((team, index) => {
    const preserved = mapping.existingByGeneratedIndex[index];
    if (preserved === undefined) throw new Error("Imported team mapping was incomplete.");
    generatedToExisting.set(team.id, preserved.id);
    return {
      ...team,
      id: preserved.id,
      leagueSeasonId: existing.id,
      ownerId: preserved.ownerId,
    };
  });

  await app.registerLeagueSeason({
    actorSessionToken: sessionToken,
    season: {
      ...generated,
      id: existing.id,
      league: { ...generated.league, id: existing.league.id },
      leagueId: existing.leagueId,
      teams,
      settings: updatedSettings(generated, generatedToExisting),
      setupStatus: existing.setupStatus,
      ...(existing.draft === undefined ? {} : { draft: existing.draft }),
    },
    memberships,
    expectedSetupRevision: leagueSeasonSetupRevision(existing),
    membershipWriteMode: "preserve",
    now,
  });
  return { status: "refreshed", leagueId: existing.leagueId, seasonId: existing.id };
};
