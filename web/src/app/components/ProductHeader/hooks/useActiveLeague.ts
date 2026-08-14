import { useSearchParams } from "react-router-dom";
import { useOnboardingQuery } from "../../../../shared/api/onboarding/onboardingQuery";
import { searchForSeason } from "../../../../shared/navigation/seasonSearch";

export const useActiveLeague = () => {
  const onboarding = useOnboardingQuery();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSeasonId = searchParams.get("seasonId");
  const leagues = onboarding.data?.leagues ?? [];
  const activeLeague = leagues.find(league => league.seasonId === requestedSeasonId) ?? leagues.at(0);
  const setActiveLeague = (seasonId: string) => {
    setSearchParams(searchForSeason(searchParams, seasonId), { replace: true });
  };
  const navigationSearch = activeLeague === undefined
    ? new URLSearchParams(searchParams)
    : searchForSeason(searchParams, activeLeague.seasonId);

  return {
    activeLeague,
    leagues,
    navigationSearch: navigationSearch.toString(),
    setActiveLeague,
  };
};
