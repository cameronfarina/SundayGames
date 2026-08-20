export interface PlatformLoadScenario {
  readonly draftClients: number;
  readonly draftClientsPerLeague: number;
  readonly leagueCount: number;
  readonly newsReaders: number;
  readonly simulationRequests: number;
}

export const platformLoadScenarioForLeagueCount = (
  leagueCount: number,
): PlatformLoadScenario => ({
  draftClients: leagueCount * 12,
  draftClientsPerLeague: 12,
  leagueCount,
  newsReaders: 1_000,
  simulationRequests: 25,
});
