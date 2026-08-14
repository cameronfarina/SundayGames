import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PracticeShortlistItem } from "../../../api/practiceContextSchema";
import {
  removePracticeTarget,
  runSimulations,
  savePracticeTarget,
} from "../../../api/practiceApi";
import { removeShortlistTarget, replaceShortlistTarget } from "../../../model/shortlist";
import { practiceQueryKeys } from "./practiceQueryKeys";

interface TargetInput {
  readonly maxBid?: number;
  readonly playerName: string;
  readonly position: string;
}

interface SimulationInput {
  readonly count: number;
  readonly note: string;
  readonly strategy: string;
}

export const useTargetMutations = (seasonId: string) => {
  const client = useQueryClient();
  const queryKey = practiceQueryKeys.shortlist(seasonId);
  const save = useMutation({
    mutationFn: (input: TargetInput) => savePracticeTarget({ seasonId, ...input }),
    onSuccess: target => client.setQueryData<readonly PracticeShortlistItem[]>(
      queryKey,
      items => replaceShortlistTarget(items, target),
    ),
  });
  const remove = useMutation({
    mutationFn: (playerName: string) => removePracticeTarget({ playerName, seasonId }),
    onSuccess: (_removed, playerName) => client.setQueryData<readonly PracticeShortlistItem[]>(
      queryKey,
      items => removeShortlistTarget(items, playerName),
    ),
  });
  return { pending: remove.isPending || save.isPending, remove, save };
};

export const useRunSimulationMutation = (seasonId: string, strategyPreset: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SimulationInput) => runSimulations({ seasonId, strategyPreset, ...input }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: practiceQueryKeys.history(seasonId) });
    },
  });
};

export const usePracticeMutations = (seasonId: string, strategyPreset: string) => ({
  run: useRunSimulationMutation(seasonId, strategyPreset),
  targets: useTargetMutations(seasonId),
});
