import { useEffect } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  cleanLeagueSearch,
  leaguePageForPath,
  leaguePath,
  leagueSlugForPath,
  searchForLeagueChange,
  selectLeagueForRoute,
} from "../../../../features/league/lib/leaguePaths";
import { useOnboardingQuery } from "../../../../shared/api/onboarding/onboardingQuery";

export const useActiveLeague = () => {
  const onboarding = useOnboardingQuery();
  const location = useLocation();
  const navigate = useNavigate();
  const { leagueSlug: routeLeagueSlug } = useParams<{ leagueSlug: string }>();
  const leagueSlug = routeLeagueSlug ?? leagueSlugForPath(location.pathname);
  const [searchParams] = useSearchParams();
  const requestedSeasonId = searchParams.get("seasonId");
  const leagues = onboarding.data?.leagues ?? [];
  const activeLeague = requestedSeasonId === "baseline"
    ? undefined
    : selectLeagueForRoute(leagues, leagueSlug, requestedSeasonId);
  const currentPage = leaguePageForPath(location.pathname);

  useEffect(() => {
    if (activeLeague === undefined || currentPage === undefined || leagueSlug !== undefined) return;
    const clean = cleanLeagueSearch(searchParams);
    void navigate({
      hash: location.hash,
      pathname: leaguePath(activeLeague, currentPage),
      search: clean.toString(),
    }, { replace: true });
  }, [activeLeague, currentPage, leagueSlug, location.hash, navigate, searchParams]);

  const setActiveLeague = (seasonId: string) => {
    const league = leagues.find(candidate => candidate.seasonId === seasonId);
    if (league === undefined) return;
    const clean = searchForLeagueChange(searchParams);
    void navigate({
      pathname: leaguePath(league, currentPage ?? "practice"),
      search: clean.toString(),
    }, { replace: true });
  };

  return {
    activeLeague,
    leagues,
    setActiveLeague,
  };
};
