import { queryOptions, skipToken, useQuery } from "@tanstack/react-query";
import {
  listPracticeShortlist,
  listSimulationHistory,
} from "../../practice/api/practiceApi";

const shortlistOptions = (seasonId: string | undefined) => queryOptions({
  queryFn: seasonId === undefined
    ? skipToken
    : ({ signal }) => listPracticeShortlist({ seasonId, signal }),
  queryKey: ["practice", "shortlist", seasonId ?? "none"],
});

const historyOptions = (seasonId: string | undefined) => queryOptions({
  queryFn: seasonId === undefined
    ? skipToken
    : ({ signal }) => listSimulationHistory({ seasonId, signal }),
  queryKey: ["practice", "history", seasonId ?? "none"],
});

export const useDraftPlanQuery = (seasonId: string | undefined) =>
  useQuery(shortlistOptions(seasonId));

export const useSimulationHistoryQuery = (seasonId: string | undefined) =>
  useQuery(historyOptions(seasonId));
