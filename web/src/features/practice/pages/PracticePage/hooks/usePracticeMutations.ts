import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PracticeShortlistItem } from "../../../api/practiceContextSchema";
import { removePracticeTarget, savePracticeTarget } from "../../../api/practiceApi";
import { removeShortlistTarget, replaceShortlistTarget } from "../../../model/shortlist";
import { practiceQueryKeys } from "./practiceQueryKeys";
import { useRunSimulationMutation } from "./useRunSimulationMutation";

interface TargetInput {
  readonly maxBid?: number;
  readonly playerName: string;
  readonly position: string;
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

export const usePracticeMutations = (seasonId: string, strategyPreset: string) => ({
  run: useRunSimulationMutation(seasonId, strategyPreset),
  targets: useTargetMutations(seasonId),
});
