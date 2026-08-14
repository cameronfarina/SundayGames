import { queryOptions, skipToken, useQuery } from "@tanstack/react-query";
import { useOnboardingQuery } from "../../../../../shared/api/onboarding/onboardingQuery";
import {
  getPlayerCatalog,
  listPracticeShortlist,
  listSimulationHistory,
  loadSimulation,
} from "../../../api/practiceApi";
import { practiceQueryKeys } from "./practiceQueryKeys";

const catalogOptions = (
  seasonId: string | undefined,
  strategy: string,
  enabled: boolean,
) => queryOptions({
  enabled,
  queryFn: ({ signal }) => getPlayerCatalog({
    ...(seasonId === undefined ? {} : { seasonId }),
    signal,
    strategy,
  }),
  queryKey: practiceQueryKeys.catalog(seasonId, strategy),
  staleTime: 60_000,
});

const shortlistOptions = (seasonId: string | undefined) => queryOptions({
  queryFn: seasonId === undefined
    ? skipToken
    : ({ signal }) => listPracticeShortlist({ seasonId, signal }),
  queryKey: practiceQueryKeys.shortlist(seasonId ?? "baseline"),
});

const historyOptions = (seasonId: string | undefined) => queryOptions({
  queryFn: seasonId === undefined
    ? skipToken
    : ({ signal }) => listSimulationHistory({ seasonId, signal }),
  queryKey: practiceQueryKeys.history(seasonId ?? "baseline"),
});

const detailOptions = (historyId: string | undefined) => queryOptions({
  queryFn: historyId === undefined
    ? skipToken
    : ({ signal }) => loadSimulation({ historyId, signal }),
  queryKey: practiceQueryKeys.simulation(historyId ?? "none"),
});

export const usePracticeContextQuery = useOnboardingQuery;
export const usePlayerCatalogQuery = (seasonId: string | undefined, strategy: string, enabled: boolean) =>
  useQuery(catalogOptions(seasonId, strategy, enabled));
export const useShortlistQuery = (seasonId: string | undefined) => useQuery(shortlistOptions(seasonId));
export const useSimulationHistoryQuery = (seasonId: string | undefined) => useQuery(historyOptions(seasonId));
export const useSimulationDetailQuery = (historyId: string | undefined) => useQuery(detailOptions(historyId));
