import type {
  AccountDashboardRepository,
  AccountDashboardSnapshot,
} from "./contracts.js";

export const loadAccountDashboard = async (
  repository: AccountDashboardRepository,
  accountId: string,
): Promise<AccountDashboardSnapshot> => ({
  leagues: await repository.listForAccount(accountId),
});
