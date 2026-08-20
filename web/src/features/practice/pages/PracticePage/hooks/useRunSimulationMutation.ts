import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
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
  const pendingRequest = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const mutation = useMutation({
    mutationFn: (input: SimulationInput) => {
      const fingerprint = JSON.stringify({ ...input, seasonId, strategyPreset });
      if (pendingRequest.current?.fingerprint !== fingerprint) {
        pendingRequest.current = { fingerprint, requestId: crypto.randomUUID() };
      }
      return runSimulations({
        ...input,
        onProgress: setProgress,
        requestId: pendingRequest.current.requestId,
        seasonId,
        strategyPreset,
      });
    },
    onMutate: input => { setProgress({ completed: 0, total: input.count }); },
    onSuccess: async response => {
      pendingRequest.current = null;
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
