import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import type {
  PlatformOnboardingLeague,
  PlatformOnboardingRepository,
  PlatformOnboardingRow,
} from "./contracts.js";
import { platformOnboardingQuery } from "./postgresQuery.js";
import { onboardingLeagueForRow } from "./rowMapper.js";

export class PostgresPlatformOnboardingRepository implements PlatformOnboardingRepository {
  constructor(private readonly client: PostgresQueryClient) {}

  async listForUser(userId: string): Promise<readonly PlatformOnboardingLeague[]> {
    const result = await this.client.query<PlatformOnboardingRow>(platformOnboardingQuery, [userId]);
    return result.rows.map(onboardingLeagueForRow);
  }
}
