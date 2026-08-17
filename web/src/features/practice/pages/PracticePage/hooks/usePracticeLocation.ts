import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { OnboardingLeague } from "../../../../../shared/api/onboarding/onboardingSchema";
import {
  leaguePath,
  leagueSlugForPath,
  searchForLeagueChange,
  selectLeagueForRoute,
} from "../../../../league/lib/leaguePaths";
import { practiceStrategy } from "../../../model/practiceNavigation";

export const usePracticeLocation = (leagues: readonly OnboardingLeague[]) => {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { leagueSlug: routeLeagueSlug } = useParams<{ leagueSlug: string }>();
  const leagueSlug = routeLeagueSlug ?? leagueSlugForPath(location.pathname);
  const historyId = params.get("runId") ?? undefined;
  const requestedRunNumber = Number(params.get("simulationRun") ?? "1");
  const selectedRunNumber = Number.isInteger(requestedRunNumber) && requestedRunNumber > 0
    ? requestedRunNumber
    : 1;
  const strategy = practiceStrategy(params.get("strategy"));
  const legacySeasonId = params.get("seasonId");
  const activeLeague = legacySeasonId === "baseline"
    ? undefined
    : selectLeagueForRoute(leagues, leagueSlug, legacySeasonId);

  const setParameter = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(name, value);
    setParams(next);
  };
  const openSimulation = (value: string, runNumber: number) => {
    const next = new URLSearchParams(params);
    next.set("runId", value);
    next.set("simulationRun", String(runNumber));
    setParams(next);
  };
  const exitSimulation = () => {
    const next = new URLSearchParams(params);
    next.delete("runId");
    next.delete("simulationRun");
    setParams(next);
  };
  const changeLeague = (value: string) => {
    const nextSearch = searchForLeagueChange(params);
    if (value === "baseline") {
      nextSearch.set("seasonId", "baseline");
      void navigate({ pathname: "/practice", search: nextSearch.toString() });
      return;
    }
    const selected = leagues.find(league => league.seasonId === value);
    if (selected !== undefined) {
      void navigate({ pathname: leaguePath(selected, "practice"), search: nextSearch.toString() });
    }
  };

  return {
    activeLeague,
    changeLeague,
    exitSimulation,
    historyId,
    openSimulation,
    selectedRunNumber,
    setParameter,
    strategy,
  };
};
