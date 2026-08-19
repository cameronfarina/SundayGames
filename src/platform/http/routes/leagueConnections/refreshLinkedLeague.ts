import { createLeagueSeasonFromConfirmedSetup } from "../../../leagueCreation.js";
import type { LeagueSeason, LeagueSeasonSettings } from "../../../leagueSeason.js";
import type { LeagueConnection, StoredLeagueSnapshot } from "../../../leagueConnections.js";
import { confirmedSetupFromSyncedLeague } from "../../../leagueSyncImport.js";
import { leagueSeasonSetupRevision } from "../../../leagueSetup.js";
import type { PlatformApp } from "../../contracts.js";

interface RefreshLinkedLeagueInput {
  app: PlatformApp;
  connection: LeagueConnection;
  previousSnapshot: StoredLeagueSnapshot | null;
  sessionToken: string;
  snapshot: StoredLeagueSnapshot;
  now: Date;
}

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

export const refreshLinkedLeague = async ({
  app,
  connection,
  previousSnapshot,
  sessionToken,
  snapshot,
  now,
}: RefreshLinkedLeagueInput): Promise<string | null> => {
  const seasonId = connection.linkedSeasonId;
  if (seasonId === undefined || connection.linkedLeagueId === undefined) return "The linked league is missing its season.";
  const existing = await app.leagueSetupRepository.findLeagueSeason(seasonId);
  if (existing === null) return "The linked Sunday Games league no longer exists.";
  if (previousSnapshot === null) return "Sync once more after reviewing the linked league teams.";

  const setup = confirmedSetupFromSyncedLeague(connection, snapshot);
  if (setup.status === "needs_attention") return setup.message;
  const generated = createLeagueSeasonFromConfirmedSetup(setup.setup);
  const existingByPosition = [...existing.teams]
    .sort((left, right) => left.draftOrderPosition - right.draftOrderPosition);
  const previousPosition = new Map(
    previousSnapshot.teams.map((team, index) => [team.providerTeamId, index]),
  );
  const generatedToExisting = new Map<string, string>();
  const teams = generated.teams.flatMap((team, index) => {
    const providerTeam = snapshot.teams[index];
    if (providerTeam === undefined) return [];
    const priorIndex = previousPosition.get(providerTeam.providerTeamId);
    const preserved = priorIndex === undefined ? undefined : existingByPosition[priorIndex];
    if (preserved === undefined) return [];
    generatedToExisting.set(team.id, preserved.id);
    return [{
      ...team,
      id: preserved.id,
      leagueSeasonId: existing.id,
      ownerId: preserved.ownerId,
      ownerDisplayName: preserved.ownerDisplayName,
    }];
  });
  if (teams.length !== generated.teams.length) {
    return "The provider team list changed. Review team assignments before overwriting this league.";
  }

  const memberships = await app.listLeagueMemberships(existing.leagueId);
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
  return null;
};
