import type { StartedPlatformServer, StartPlatformServerOptions } from "./contracts.js";
import { createPlatformServer } from "./createPlatformServer.js";
import { hostForUrl, listen } from "./serverLifecycle.js";

export const startPlatformServer = async (
  options: StartPlatformServerOptions,
): Promise<StartedPlatformServer> => {
  const { host = "127.0.0.1", port = 0, ...serverOptions } = options;
  const platformServer = await createPlatformServer(serverOptions);
  await listen(platformServer.server, port, host);
  const address = platformServer.server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("Expected platform server to listen on a TCP address.");
  }
  const startedPort = address.port;
  return {
    server: platformServer.server,
    get app() { return platformServer.app; },
    get store() { return platformServer.store; },
    get authRepository() { return platformServer.authRepository; },
    get leagueSetupRepository() { return platformServer.leagueSetupRepository; },
    get historicalImportRepository() { return platformServer.historicalImportRepository; },
    get jobRepository() { return platformServer.jobRepository; },
    get simulationRepository() { return platformServer.simulationRepository; },
    get practiceShortlistRepository() { return platformServer.practiceShortlistRepository; },
    get playerNewsRepository() { return platformServer.playerNewsRepository; },
    get fantasyProsRepository() { return platformServer.fantasyProsRepository; },
    get liveDraftRoomRepository() { return platformServer.liveDraftRoomRepository; },
    get exportArtifactRepository() { return platformServer.exportArtifactRepository; },
    get invitationRepository() { return platformServer.invitationRepository; },
    get onboardingRepository() { return platformServer.onboardingRepository; },
    get liveDraftRoomSetupRepository() { return platformServer.liveDraftRoomSetupRepository; },
    handler: platformServer.handler,
    get draftToolsAdapter() { return platformServer.draftToolsAdapter; },
    get jobHandlers() { return platformServer.jobHandlers; },
    get fileStore() { return platformServer.fileStore; },
    get postgresStore() { return platformServer.postgresStore; },
    get postgresAuthRepository() { return platformServer.postgresAuthRepository; },
    get postgresLeagueSetupRepository() { return platformServer.postgresLeagueSetupRepository; },
    get postgresHistoricalImportRepository() {
      return platformServer.postgresHistoricalImportRepository;
    },
    get postgresJobQueue() { return platformServer.postgresJobQueue; },
    get postgresSimulationRepository() { return platformServer.postgresSimulationRepository; },
    get postgresLiveDraftRoomRepository() { return platformServer.postgresLiveDraftRoomRepository; },
    get postgresExportArtifactRepository() {
      return platformServer.postgresExportArtifactRepository;
    },
    get postgresInvitationRepository() { return platformServer.postgresInvitationRepository; },
    get postgresLiveDraftRoomSetupRepository() {
      return platformServer.postgresLiveDraftRoomSetupRepository;
    },
    persist: platformServer.persist,
    close: platformServer.close,
    host,
    port: startedPort,
    url: `http://${hostForUrl(host)}:${startedPort}`,
  };
};
