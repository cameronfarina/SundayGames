import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  claimLeagueTeam,
  loadLeagueOnboarding,
  loadLeagueSeason,
  loadSeasonKeepers,
  type ClaimLeagueTeamInput,
} from "../api/leagueApi";
import { selectActiveLeague } from "../lib/leagueDisplay";

const onboardingKey = ["league-onboarding"];
const seasonKey = (seasonId: string) => ["league-season", seasonId];
const keepersKey = (seasonId: string) => ["season-keepers", seasonId];
const onboardingOptions = () => queryOptions({
  queryKey: onboardingKey,
  queryFn: () => loadLeagueOnboarding(),
});
const seasonOptions = (seasonId: string, enabled: boolean) => queryOptions({
  queryKey: seasonKey(seasonId),
  queryFn: () => loadLeagueSeason(seasonId),
  enabled,
});
const keepersOptions = (seasonId: string, enabled: boolean) => queryOptions({
  queryKey: keepersKey(seasonId),
  queryFn: () => loadSeasonKeepers(seasonId),
  enabled,
});

export const useLeaguePageData = (requestedSeasonId: string | null) => {
  const onboarding = useQuery(onboardingOptions());
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
        queryClient.invalidateQueries({ queryKey: onboardingKey }),
        queryClient.invalidateQueries({ queryKey: seasonKey(input.seasonId) }),
      ]);
    },
  });
};
