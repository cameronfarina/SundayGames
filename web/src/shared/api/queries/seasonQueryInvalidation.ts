import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { onboardingQueryOptions } from "../onboarding/onboardingQuery";
import { seasonQueryKeys } from "./seasonQueryKeys";

const invalidateExact = async (client: QueryClient, queryKeys: readonly QueryKey[]) => {
  await Promise.all(queryKeys.map(async queryKey => {
    await client.invalidateQueries({ exact: true, queryKey });
  }));
};

const invalidateCatalogs = async (client: QueryClient, seasonId: string) => {
  await client.invalidateQueries({ queryKey: seasonQueryKeys.practiceCatalogPrefix(seasonId) });
};

export const invalidateKeeperConsumers = async (client: QueryClient, seasonId: string) => {
  await Promise.all([
    invalidateExact(client, [
      seasonQueryKeys.commissionerKeepers(seasonId),
      seasonQueryKeys.seasonKeepers(seasonId),
    ]),
    invalidateCatalogs(client, seasonId),
  ]);
};

export const invalidateLeagueSetupConsumers = async (client: QueryClient, seasonId: string) => {
  await Promise.all([
    invalidateExact(client, [
      seasonQueryKeys.onboarding(),
      seasonQueryKeys.commissionerSeason(seasonId),
      seasonQueryKeys.leagueSeason(seasonId),
      seasonQueryKeys.seasonTeam(seasonId),
      seasonQueryKeys.commissionerInvitations(seasonId),
      seasonQueryKeys.commissionerKeepers(seasonId),
      seasonQueryKeys.seasonKeepers(seasonId),
    ]),
    invalidateCatalogs(client, seasonId),
  ]);
};

export const invalidateLiveRoomConsumers = async (client: QueryClient, seasonId: string) => {
  await invalidateExact(client, [
    seasonQueryKeys.onboarding(),
    seasonQueryKeys.commissionerSeason(seasonId),
    seasonQueryKeys.leagueSeason(seasonId),
  ]);
};

export const invalidatePublishedSeasonConsumers = async (client: QueryClient, seasonId: string) => {
  await invalidateExact(client, [
    seasonQueryKeys.onboarding(),
    seasonQueryKeys.commissionerSeason(seasonId),
    seasonQueryKeys.leagueSeason(seasonId),
    seasonQueryKeys.seasonTeam(seasonId),
  ]);
};

export const refreshInvitationClaimOnboarding = async (client: QueryClient) => {
  await client.invalidateQueries({
    exact: true,
    queryKey: seasonQueryKeys.onboarding(),
    refetchType: "none",
  });
  await client.fetchQuery(onboardingQueryOptions());
};
