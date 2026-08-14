import { InMemoryPlatformStore } from "../../../src/platform/platformApp.js";
import type {
  LeagueSetupRepository,
  RegisterLeagueSeasonRepositoryInput,
} from "../../../src/platform/leagueSetup.js";

export class AsyncLeagueSetupRepository implements LeagueSetupRepository {
  readonly inner = new InMemoryPlatformStore();
  readonly registerInputs: RegisterLeagueSeasonRepositoryInput[] = [];

  async registerLeagueSeason(input: RegisterLeagueSeasonRepositoryInput) {
    this.registerInputs.push(structuredClone(input));

    return this.inner.registerLeagueSeason(input);
  }

  async archiveLeague(input: Parameters<LeagueSetupRepository["archiveLeague"]>[0]) {
    return this.inner.archiveLeague(input);
  }

  async isLeagueArchived(leagueId: string) {
    return this.inner.isLeagueArchived(leagueId);
  }

  async claimLeagueSeasonTeam(input: Parameters<LeagueSetupRepository["claimLeagueSeasonTeam"]>[0]) {
    return this.inner.claimLeagueSeasonTeam(input);
  }

  async joinLeagueSeasonTeam(input: Parameters<LeagueSetupRepository["joinLeagueSeasonTeam"]>[0]) {
    return this.inner.joinLeagueSeasonTeam(input);
  }

  async findLeagueSeason(seasonId: string) {
    return this.inner.findLeagueSeason(seasonId);
  }

  async hasLeagueSeasonForLeague(leagueId: string) {
    return this.inner.hasLeagueSeasonForLeague(leagueId);
  }

  async findLeagueSeasonForLeagueYear(leagueId: string, seasonYear: number) {
    return this.inner.findLeagueSeasonForLeagueYear(leagueId, seasonYear);
  }

  async findMembership(userId: string, leagueId: string) {
    return this.inner.findMembership(userId, leagueId);
  }

  async membershipsForLeague(leagueId: string) {
    return this.inner.membershipsForLeague(leagueId);
  }
}
