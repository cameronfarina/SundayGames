import { useSearchParams } from "react-router-dom";
import { useOnboardingQuery } from "../../../../shared/api/onboarding/onboardingQuery";

export const useActiveLeague = () => {
  const onboarding = useOnboardingQuery();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSeasonId = searchParams.get("seasonId");
  const leagues = onboarding.data?.leagues ?? [];
  const activeLeague = leagues.find(league => league.seasonId === requestedSeasonId) ?? leagues.at(0);
  const setActiveLeague = (seasonId: string) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set("seasonId", seasonId);
    setSearchParams(nextSearchParams, { replace: true });
  };
  const navigationSearch = new URLSearchParams(searchParams);
  if (activeLeague !== undefined) navigationSearch.set("seasonId", activeLeague.seasonId);

  return {
    activeLeague,
    leagues,
    navigationSearch: navigationSearch.toString(),
    setActiveLeague,
  };
};
