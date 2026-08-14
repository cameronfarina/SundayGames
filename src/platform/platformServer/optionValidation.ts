import type { CreatePlatformServerOptions } from "./contracts.js";

const exclusiveRepositoryPairs: readonly [keyof CreatePlatformServerOptions, keyof CreatePlatformServerOptions, string][] = [
  ["authRepository", "postgresAuthClient", "authRepository or postgresAuthClient"],
  ["leagueSetupRepository", "postgresLeagueSetupClient", "leagueSetupRepository or postgresLeagueSetupClient"],
  ["historicalImportRepository", "postgresHistoricalImportClient", "historicalImportRepository or postgresHistoricalImportClient"],
  ["jobRepository", "postgresJobClient", "jobRepository or postgresJobClient"],
  ["simulationRepository", "postgresSimulationClient", "simulationRepository or postgresSimulationClient"],
  ["liveDraftRoomRepository", "postgresLiveDraftRoomClient", "liveDraftRoomRepository or postgresLiveDraftRoomClient"],
  ["exportArtifactRepository", "postgresExportArtifactClient", "exportArtifactRepository or postgresExportArtifactClient"],
];

export const validatePlatformServerOptions = (options: CreatePlatformServerOptions): void => {
  if (options.emailVerificationRequired === true &&
      (options.authMailSender === undefined || options.publicBaseUrl === undefined)) {
    throw new Error("Email verification requires an auth mail sender and public base URL.");
  }
  for (const [repositoryKey, clientKey, label] of exclusiveRepositoryPairs) {
    if (options[repositoryKey] !== undefined && options[clientKey] !== undefined) {
      throw new Error(`Configure either ${label}, not both.`);
    }
  }
};
