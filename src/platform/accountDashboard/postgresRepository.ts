import { accountDashboardQuery } from "./query.js";
import type {
  AccountDashboardLeague,
  AccountDashboardQueryClient,
  AccountDashboardRepository,
  AccountDashboardRow,
} from "./contracts.js";
import { dashboardLeagueFromRow } from "./rowMapper.js";

export class PostgresAccountDashboardRepository implements AccountDashboardRepository {
  constructor(private readonly client: AccountDashboardQueryClient) {}

  async listForAccount(accountId: string): Promise<readonly AccountDashboardLeague[]> {
    const result = await this.client.query<AccountDashboardRow>(accountDashboardQuery, [accountId]);
    return result.rows.map(dashboardLeagueFromRow);
  }
}
