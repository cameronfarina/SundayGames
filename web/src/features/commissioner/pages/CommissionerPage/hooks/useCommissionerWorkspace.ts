import { queryOptions, useQuery } from "@tanstack/react-query";
import { useOnboardingQuery } from "../../../../../shared/api/onboarding/onboardingQuery";
import { seasonQueryKeys } from "../../../../../shared/api/queries/seasonQueryKeys";
import { commissionerApi } from "../../../api/commissionerApi";
import { selectLeagueForRoute } from "../../../../league/lib/leaguePaths";

const seasonOptions = (seasonId: string, enabled: boolean) => queryOptions({
  queryKey: seasonQueryKeys.commissionerSeason(seasonId),
  queryFn: () => commissionerApi.season(seasonId),
  enabled,
});

const keeperOptions = (seasonId: string, enabled: boolean) => queryOptions({
  queryKey: seasonQueryKeys.commissionerKeepers(seasonId),
  queryFn: () => commissionerApi.keepers(seasonId),
  enabled,
});

const invitationOptions = (seasonId: string, enabled: boolean) => queryOptions({
  queryKey: seasonQueryKeys.commissionerInvitations(seasonId),
  queryFn: () => commissionerApi.invitations(seasonId),
  enabled,
});

export const useCommissionerWorkspace = (
  requestedSeasonId: string | null,
  requestedLeagueSlug?: string,
) => {
  const onboarding = useOnboardingQuery();
  const manageableLeagues = onboarding.data?.leagues.filter(league => league.canManageLeague) ?? [];
  const requestedLeague = selectLeagueForRoute(
    onboarding.data?.leagues ?? [],
    requestedLeagueSlug,
    requestedSeasonId,
  );
  const selectedLeague = requestedLeague ?? manageableLeagues[0];
  const seasonId = selectedLeague?.seasonId ?? "";
  const canLoad = selectedLeague?.canManageLeague === true;
  const season = useQuery(seasonOptions(seasonId, canLoad));
  const keepers = useQuery(keeperOptions(seasonId, canLoad));
  const invitations = useQuery(invitationOptions(seasonId, canLoad));

  return { onboarding, selectedLeague, season, keepers, invitations };
};
