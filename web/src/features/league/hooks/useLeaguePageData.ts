import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  onboardingQueryKey,
  useOnboardingQuery,
} from "../../../shared/api/onboarding/onboardingQuery";
import { seasonQueryKeys } from "../../../shared/api/queries/seasonQueryKeys";
import {
  claimLeagueTeam,
  loadLeagueSeason,
  loadSeasonKeepers,
  type ClaimLeagueTeamInput,
} from "../api/leagueApi";
import { selectActiveLeague } from "../lib/leagueDisplay";

const seasonOptions = (seasonId: string, enabled: boolean) => queryOptions({
  queryKey: seasonQueryKeys.leagueSeason(seasonId),
  queryFn: () => loadLeagueSeason(seasonId),
  enabled,
});
const keepersOptions = (seasonId: string, enabled: boolean) => queryOptions({
  queryKey: seasonQueryKeys.seasonKeepers(seasonId),
  queryFn: () => loadSeasonKeepers(seasonId),
  enabled,
});

export const useLeaguePageData = (requestedSeasonId: string | null) => {
  const onboarding = useOnboardingQuery();
  const selectedLeague = onboarding.data === undefined
    ? undefined
    : selectActiveLeague(onboarding.data, requestedSeasonId);
  const seasonId = selectedLeague?.seasonId ?? "";
  const season = useQuery(seasonOptions(seasonId, selectedLeague !== undefined));
  const keepers = useQuery(keepersOptions(seasonId, selectedLeague !== undefined));

  return { onboarding, selectedLeague, season, keepers };
};

export const useClaimLeagueTeam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ClaimLeagueTeamInput) => claimLeagueTeam(input),
    onSuccess: async (_response, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: onboardingQueryKey() }),
        queryClient.invalidateQueries({ queryKey: seasonQueryKeys.leagueSeason(input.seasonId) }),
      ]);
    },
  });
};
