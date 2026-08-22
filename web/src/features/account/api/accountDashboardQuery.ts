import { queryOptions, useQuery } from "@tanstack/react-query";
import { getAccountDashboard } from "./accountDashboardApi";

const dashboardQueryKey = (): readonly ["account", "dashboard"] => ["account", "dashboard"];

export const accountDashboardQueryOptions = () => queryOptions({
  queryFn: ({ signal }) => getAccountDashboard(signal),
  queryKey: dashboardQueryKey(),
  staleTime: 60_000,
});

export const useAccountDashboardQuery = () => useQuery(accountDashboardQueryOptions());
