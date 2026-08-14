import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { runSimulations } from "../../../api/practiceApi";
import type { SimulationProgress } from "../../../api/simulationSchema";
import { practiceQueryKeys } from "./practiceQueryKeys";

interface SimulationInput {
  readonly count: number;
  readonly note: string;
  readonly strategy: string;
}

export const useRunSimulationMutation = (
  seasonId: string,
  strategyPreset: string,
) => {
  const client = useQueryClient();
  const [progress, setProgress] = useState<SimulationProgress>();
  const mutation = useMutation({
    mutationFn: (input: SimulationInput) => runSimulations({
      ...input,
      onProgress: setProgress,
      seasonId,
      strategyPreset,
    }),
    onMutate: input => { setProgress({ completed: 0, total: input.count }); },
    onSuccess: async response => {
      setProgress({
        completed: response.summary.completedCount,
        total: response.summary.runCount,
      });
      client.setQueryData(practiceQueryKeys.simulation(response.historyId), response);
      await client.invalidateQueries({ queryKey: practiceQueryKeys.history(seasonId) });
    },
    onError: () => { setProgress(undefined); },
  });
  return { mutation, progress };
};
