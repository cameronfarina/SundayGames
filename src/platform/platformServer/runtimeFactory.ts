import { createPlatformApp } from "../platformApp.js";
import { createPlatformHttpHandler } from "../platformHttp.js";
import type { LiveDraftRoomRevisionNotifier } from "../liveDraftRoomRealtime.js";
import { createPlatformJobHandlers } from "../platformJobHandlers.js";
import type { SeasonSimulationRunner } from "../seasonSimulationWorkerRunner.js";
import { createAcceptedMembershipApplier } from "./acceptedMembership.js";
import type { PlatformAdmissions } from "./admissions.js";
import type { CreatePlatformServerOptions } from "./contracts.js";
import type { PlatformRuntimeFactory } from "./internalContracts.js";
import { createLiveDraftRoomSetupProvider } from "./liveDraftSetupProvider.js";
import { composeRuntimeRepositories } from "./repositoryComposition.js";

interface CreateRuntimeFactoryOptions {
  options: CreatePlatformServerOptions;
  admissions: PlatformAdmissions;
  liveDraftRoomNotifier: LiveDraftRoomRevisionNotifier;
  seasonSimulationRunner: SeasonSimulationRunner;
  persistForJobs: () => Promise<void>;
}

export const createPlatformRuntimeFactory = (
  input: CreateRuntimeFactoryOptions,
): PlatformRuntimeFactory => loadedStore => {
  const { options, admissions } = input;
  const repositories = composeRuntimeRepositories(options, loadedStore);
  const liveDraftRoomSetupProvider = createLiveDraftRoomSetupProvider(options, repositories);
  const app = createPlatformApp({
    store: repositories.store,
    authRepository: repositories.authRepository,
    authEmail: {
      verificationRequired: options.emailVerificationRequired ?? false,
      ...(options.authMailSender === undefined ? {} : { mailSender: options.authMailSender }),
      ...(options.publicBaseUrl === undefined ? {} : { publicBaseUrl: options.publicBaseUrl }),
    },
    leagueSetupRepository: repositories.leagueSetupRepository,
    historicalImportRepository: repositories.historicalImportRepository,
    jobRepository: repositories.jobRepository,
    simulationRepository: repositories.simulationRepository,
    practiceShortlistRepository: repositories.practiceShortlistRepository,
    liveDraftRoomRepository: repositories.liveDraftRoomRepository,
    exportArtifactRepository: repositories.exportArtifactRepository,
    simulationRunner: options.simulationRunner,
  });
  const applyAcceptedMembership = createAcceptedMembershipApplier(repositories);
  const platformHandler = createPlatformHttpHandler(app, {
    invitationRepository: repositories.invitationRepository,
    leagueSetupRepository: repositories.leagueSetupRepository,
    onboardingRepository: repositories.onboardingRepository,
    ...(options.currentPlayerCatalogProvider === undefined
      ? {} : { currentPlayerCatalogProvider: options.currentPlayerCatalogProvider }),
    ...(options.espnLeagueSettingsImporter === undefined
      ? {} : { espnLeagueSettingsImporter: options.espnLeagueSettingsImporter }),
    liveDraftRoomSetupProvider,
    liveDraftRoomSetupRepository: repositories.liveDraftRoomSetupRepository,
    ...(options.postDraftProjectionProvider === undefined
      ? {} : { postDraftProjectionProvider: options.postDraftProjectionProvider }),
    ...(options.provisioningToken === undefined ? {} : { provisioningToken: options.provisioningToken }),
    ...(options.invitationTokenSecret === undefined
      ? {} : { invitationTokenSecret: options.invitationTokenSecret }),
    ...(options.allowPublicSignup === undefined ? {} : { allowPublicSignup: options.allowPublicSignup }),
    ...(options.emailVerificationRequired === undefined
      ? {} : { emailVerificationRequired: options.emailVerificationRequired }),
    accountRateLimiter: admissions.accountRateLimiter,
    loginRateLimiter: admissions.loginRateLimiter,
    verificationRateLimiter: admissions.verificationRateLimiter,
    passwordResetRateLimiter: admissions.passwordResetRateLimiter,
    passwordResetConsumeRateLimiter: admissions.passwordResetConsumeRateLimiter,
    authClientRateLimiter: admissions.authClientRateLimiter,
    screenshotImportRateLimiter: admissions.screenshotImportRateLimiter,
    leagueImportRateLimiter: admissions.leagueImportRateLimiter,
    simulationRateLimiter: admissions.simulationRateLimiter,
    liveDraftMutationRateLimiter: admissions.liveDraftMutationRateLimiter,
    openLiveDraftRoomRevisionSubscription: subscription =>
      input.liveDraftRoomNotifier.subscribe(subscription),
    seasonSimulationRunner: input.seasonSimulationRunner,
    ...(options.leagueMembersScreenshotAnalyzer === undefined
      ? {} : { leagueMembersScreenshotAnalyzer: options.leagueMembersScreenshotAnalyzer }),
    ...(applyAcceptedMembership === undefined ? {} : { applyAcceptedMembership }),
    ...(options.readinessProbe === undefined ? {} : { readinessProbe: options.readinessProbe }),
  });

  return {
    ...repositories,
    app,
    platformHandler,
    liveDraftRoomSetupProvider,
    rawJobHandlers: createPlatformJobHandlers({
      app,
      persist: repositories.simulationRepository === repositories.store.simulations
        ? input.persistForJobs
        : undefined,
    }),
  };
};
