import type { Server } from "node:http";
import type { PlatformDraftToolsAdapter } from "../platformDraftToolsAdapter.js";
import type { PlatformHttpHandler } from "../platformHttp.js";
import type { PlatformJobHandlers } from "../platformJobOrchestrator.js";
import type { PlatformServer } from "./contracts.js";
import type { PlatformRuntimeHolder } from "./internalContracts.js";
import { closeServer } from "./serverLifecycle.js";

interface PlatformServerShapeOptions {
  server: Server;
  runtimeHolder: PlatformRuntimeHolder;
  handler: PlatformHttpHandler;
  draftToolsAdapter: PlatformDraftToolsAdapter;
  jobHandlers: PlatformJobHandlers;
  persist: () => Promise<void>;
  abortAndDrainActiveStreams: () => Promise<void>;
  closeLiveDraftRoomRevisionListener: () => Promise<void>;
}

export const createPlatformServerShape = (
  input: PlatformServerShapeOptions,
): PlatformServer => ({
  server: input.server,
  get app() { return input.runtimeHolder.current().app; },
  get store() { return input.runtimeHolder.current().store; },
  get authRepository() { return input.runtimeHolder.current().authRepository; },
  get leagueSetupRepository() { return input.runtimeHolder.current().leagueSetupRepository; },
  get historicalImportRepository() {
    return input.runtimeHolder.current().historicalImportRepository;
  },
  get jobRepository() { return input.runtimeHolder.current().jobRepository; },
  get simulationRepository() { return input.runtimeHolder.current().simulationRepository; },
  get mockDraftSessionRepository() {
    return input.runtimeHolder.current().mockDraftSessionRepository;
  },
  get practiceShortlistRepository() {
    return input.runtimeHolder.current().practiceShortlistRepository;
  },
  get playerNewsRepository() { return input.runtimeHolder.current().playerNewsRepository; },
  get fantasyProsRepository() { return input.runtimeHolder.current().fantasyProsRepository; },
  get leagueConnectionRepository() {
    return input.runtimeHolder.current().leagueConnectionRepository;
  },
  get liveDraftRoomRepository() { return input.runtimeHolder.current().liveDraftRoomRepository; },
  get exportArtifactRepository() { return input.runtimeHolder.current().exportArtifactRepository; },
  get invitationRepository() { return input.runtimeHolder.current().invitationRepository; },
  get onboardingRepository() { return input.runtimeHolder.current().onboardingRepository; },
  get liveDraftRoomSetupRepository() {
    return input.runtimeHolder.current().liveDraftRoomSetupRepository;
  },
  handler: input.handler,
  draftToolsAdapter: input.draftToolsAdapter,
  jobHandlers: input.jobHandlers,
  persist: input.persist,
  close: async () => {
    const serverClosed = closeServer(input.server);
    await input.abortAndDrainActiveStreams();
    input.server.closeIdleConnections();
    await serverClosed;
    await input.closeLiveDraftRoomRevisionListener();
    await input.draftToolsAdapter.close();
  },
  get fileStore() { return input.runtimeHolder.current().fileStore; },
  get postgresStore() { return input.runtimeHolder.current().postgresStore; },
  get postgresAuthRepository() {
    return input.runtimeHolder.current().postgresAuthRepository;
  },
  get postgresLeagueSetupRepository() {
    return input.runtimeHolder.current().postgresLeagueSetupRepository;
  },
  get postgresHistoricalImportRepository() {
    return input.runtimeHolder.current().postgresHistoricalImportRepository;
  },
  get postgresJobQueue() { return input.runtimeHolder.current().postgresJobQueue; },
  get postgresSimulationRepository() {
    return input.runtimeHolder.current().postgresSimulationRepository;
  },
  get postgresLiveDraftRoomRepository() {
    return input.runtimeHolder.current().postgresLiveDraftRoomRepository;
  },
  get postgresExportArtifactRepository() {
    return input.runtimeHolder.current().postgresExportArtifactRepository;
  },
  get postgresInvitationRepository() {
    return input.runtimeHolder.current().postgresInvitationRepository;
  },
  get postgresLiveDraftRoomSetupRepository() {
    return input.runtimeHolder.current().postgresLiveDraftRoomSetupRepository;
  },
});
