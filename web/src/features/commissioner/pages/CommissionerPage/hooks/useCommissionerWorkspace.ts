import { queryOptions, useQuery } from "@tanstack/react-query";
import { useOnboardingQuery } from "../../../../../shared/api/onboarding/onboardingQuery";
import { commissionerApi } from "../../../api/commissionerApi";

export const commissionerKeys = {
  season: (seasonId: string) => ["commissioner", "season", seasonId],
  keepers: (seasonId: string) => ["commissioner", "keepers", seasonId],
  invitations: (seasonId: string) => ["commissioner", "invitations", seasonId],
};

const seasonOptions = (seasonId: string, enabled: boolean) => queryOptions({
  queryKey: commissionerKeys.season(seasonId),
  queryFn: () => commissionerApi.season(seasonId),
  enabled,
});

const keeperOptions = (seasonId: string, enabled: boolean) => queryOptions({
  queryKey: commissionerKeys.keepers(seasonId),
  queryFn: () => commissionerApi.keepers(seasonId),
  enabled,
});

const invitationOptions = (seasonId: string, enabled: boolean) => queryOptions({
  queryKey: commissionerKeys.invitations(seasonId),
  queryFn: () => commissionerApi.invitations(seasonId),
  enabled,
});

export const useCommissionerWorkspace = (requestedSeasonId: string | null) => {
  const onboarding = useOnboardingQuery();
  const manageableLeagues = onboarding.data?.leagues.filter(league => league.canManageLeague) ?? [];
  const requestedLeague = onboarding.data?.leagues.find(league => league.seasonId === requestedSeasonId);
  const selectedLeague = requestedLeague ?? manageableLeagues[0];
  const seasonId = selectedLeague?.seasonId ?? "";
  const canLoad = selectedLeague?.canManageLeague === true;
  const season = useQuery(seasonOptions(seasonId, canLoad));
  const keepers = useQuery(keeperOptions(seasonId, canLoad));
  const invitations = useQuery(invitationOptions(seasonId, canLoad));

  return { onboarding, selectedLeague, season, keepers, invitations };
};
