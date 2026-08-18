import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { seasonQueryKeys } from "../../../../shared/api/queries/seasonQueryKeys";
import { commissionerApi } from "../../api/commissionerApi";
import type { CommissionerSeason } from "../../api/seasonSchemas";
import { errorMessage } from "../../model/errorMessage";
import { fileBase64 } from "../../model/fileBase64";
import { historicalOwnerNeeds } from "../../model/historicalOwnerNeeds";
import type { HistoricalFileItem, HistoricalQueueAction } from "../../model/historicalFileQueue";

export interface ImportableFile { readonly item: HistoricalFileItem; readonly seasonYear: number }
interface ImportOutcome {
  readonly id: string; readonly message: string;
  readonly ownerNeeds?: readonly string[];
  readonly status: HistoricalFileItem["status"];
}
interface ImportProgress { readonly completed: number; readonly total: number }
interface HistoricalImportRunOptions {
  readonly dispatch: (action: HistoricalQueueAction) => void;
  readonly keepersInFirstRow: boolean;
  readonly replace: boolean;
  readonly season: CommissionerSeason;
}

export const useHistoricalImportRun = ({
  dispatch,
  keepersInFirstRow,
  replace,
  season,
}: HistoricalImportRunOptions) => {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<ImportProgress>({ completed: 0, total: 0 });
  const importOne = async ({ item, seasonYear }: ImportableFile): Promise<ImportOutcome> => {
    try {
      const preview = await commissionerApi.previewHistory({
        base64: await fileBase64(item.file),
        fileName: item.file.name,
        inferFirstRosterRowAsKeeper: keepersInFirstRow,
        mimeType: item.file.type || "application/octet-stream",
        ownerMappings: Object.entries(item.ownerMappings).map(([sourceOwnerOrTeamLabel, teamId]) => ({
          sourceOwnerOrTeamLabel, teamId,
        })),
        replacementRequested: replace,
        seasonId: season.id,
        seasonYear,
      });
      const ownerNeeds = historicalOwnerNeeds(item, preview.batch.rows);
      if (preview.batch.status === "blocked") {
        const messages = preview.batch.blockers.map(blocker => blocker.message);
        return {
          id: item.id,
          message: ownerNeeds.length > 0 ? "Match historical teams below, then import again." : messages.join(" "),
          ownerNeeds,
          status: ownerNeeds.length > 0 ? "mapping" : "error",
        };
      }
      const committed = await commissionerApi.commitHistory(preview.batch.id, season.id, seasonYear);
      return {
        id: item.id,
        message: `${String(committed.committedRecords.length)} players imported`,
        status: "imported",
      };
    } catch (error) {
      return { id: item.id, message: errorMessage(error), status: "error" };
    } finally {
      setProgress(current => ({ ...current, completed: current.completed + 1 }));
    }
  };
  const importFiles = useMutation({
    mutationFn: async (files: readonly ImportableFile[]): Promise<readonly ImportOutcome[]> =>
      await Promise.all(files.map(importOne)),
    onSuccess: outcomes => {
      outcomes.forEach(outcome => { dispatch({ type: "result", ...outcome }); });
      if (outcomes.some(outcome => outcome.status === "imported")) {
        void queryClient.invalidateQueries({
          queryKey: seasonQueryKeys.commissionerHistoricalImports(season.id),
        });
      }
    },
  });

  return {
    isPending: importFiles.isPending,
    percent: progress.total === 0 ? 0 : (progress.completed / progress.total) * 100,
    progress,
    start: (files: readonly ImportableFile[], total: number) => {
      setProgress({ completed: 0, total });
      importFiles.mutate(files);
    },
  };
};
