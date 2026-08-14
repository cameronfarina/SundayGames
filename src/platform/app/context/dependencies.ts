import { createAuthService } from "../../auth.js";
import type { PlatformAppOptions } from "../contracts/options.js";
import { InMemoryPlatformStore } from "../store/InMemoryPlatformStore.js";
import type { PlatformAppDependencies } from "./types.js";

export const resolvePlatformAppDependencies = (
  options: PlatformAppOptions,
): PlatformAppDependencies => {
  const store = options.store ?? new InMemoryPlatformStore();
  const authRepository = options.authRepository ?? store.authRepository;
  const leagueSetup = options.leagueSetupRepository ?? store;
  const authEmail = options.authEmail;
  const auth = createAuthService({
    repository: authRepository,
    emailVerificationRequired: authEmail?.verificationRequired ?? false,
    ...(authEmail?.mailSender === undefined ? {} : { mailSender: authEmail.mailSender }),
    ...(authEmail?.publicBaseUrl === undefined ? {} : { publicBaseUrl: authEmail.publicBaseUrl }),
  });

  return {
    store,
    auth,
    authRepository,
    leagueSetup,
    historicalImports: options.historicalImportRepository ?? store.historicalImports,
    jobs: options.jobRepository ?? store.jobs,
    simulations: options.simulationRepository ?? store.simulations,
    practiceShortlists: options.practiceShortlistRepository ?? store.practiceShortlists,
    liveDraftRooms: options.liveDraftRoomRepository ?? store.liveDraftRooms,
    exportArtifacts: options.exportArtifactRepository ?? store.exportArtifacts,
    usesExternalLeagueSetup: leagueSetup !== store,
  };
};
