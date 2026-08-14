import { InMemoryPlatformStore, buildCurrentMockdLeagueSeason, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, leagueConfig, mockRunner, ownerOrder, playerCatalog, postDraftScoringSettingsIdForSeason } from "../support/index.js";
import type { LeagueSeason, LoggedInAccount, PlatformHttpHandler } from "../support/index.js";

export interface RoutingContext {
  handle: PlatformHttpHandler;
  owner11: LoggedInAccount;
  owner04: LoggedInAccount;
  season: LeagueSeason;
  camTeam: LeagueSeason["teams"][number];
  sethTeam: LeagueSeason["teams"][number];
}

export const createRoutingContext = async (): Promise<RoutingContext> => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app, {
      allowPublicSignup: true,
      provisioningToken: "test-provisioning-token",
      currentPlayerCatalogProvider: async () => playerCatalog,
      openLiveDraftRoomRevisionSubscription: () => ({
        close: () => undefined,
        waitForRevision: async () => false,
      }),
      postDraftProjectionProvider: async (projectionSeason, catalog, evaluatedAt) => ({
        metadata: {
          snapshotId: "test-projections",
          leagueId: projectionSeason.leagueId,
          seasonId: projectionSeason.id,
          scoringSettingsId: postDraftScoringSettingsIdForSeason(projectionSeason),
          generatedAt: evaluatedAt.toISOString(),
          validThrough: new Date(evaluatedAt.getTime() + 60_000).toISOString(),
          week: 1,
        },
        projections: catalog.map((player, index) => ({
          playerId: `player-${index + 1}`,
          playerName: player.name,
          position: player.position,
          seasonProjectedPoints: Math.max(1, player.expectedPrice) * 4,
          weeklyProjectedPoints: Math.max(1, player.expectedPrice),
        })),
      }),
    });
    const owner11 = await createLoggedInAccount(handle, "owner11@example.com");
    const owner04 = await createLoggedInAccount(handle, "owner04@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Owner04");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");
  return { handle, owner11, owner04, season, camTeam, sethTeam };
};
