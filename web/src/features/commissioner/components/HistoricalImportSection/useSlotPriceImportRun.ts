import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { seasonQueryKeys } from "../../../../shared/api/queries/seasonQueryKeys";
import { commissionerApi } from "../../api/commissionerApi";
import { errorMessage } from "../../model/errorMessage";
import type { SlotPriceSeasonSheet } from "../../model/slotPriceSeasons";

export interface SlotPriceImportOutcome {
  readonly seasonYear: number;
  readonly message: string;
  readonly status: "imported" | "error";
}

interface SlotPriceImportRunOptions {
  readonly replace: boolean;
  readonly seasonId: string;
}

const blockedMessage = (messages: readonly string[]): string =>
  messages.length === 0
    ? "This sheet could not be imported."
    : [...new Set(messages)].slice(0, 3).join(" ");

export const useSlotPriceImportRun = ({ replace, seasonId }: SlotPriceImportRunOptions) => {
  const queryClient = useQueryClient();
  const [completed, setCompleted] = useState(0);

  const importOne = async (sheet: SlotPriceSeasonSheet): Promise<SlotPriceImportOutcome> => {
    try {
      const preview = await commissionerApi.previewHistoryText({
        replacementRequested: replace,
        seasonId,
        seasonYear: sheet.seasonYear,
        sourceText: sheet.sourceText,
      });
      const warnings = preview.source.sourceWarnings ?? [];
      if (preview.batch.status === "blocked") {
        return {
          seasonYear: sheet.seasonYear,
          message: blockedMessage([
            ...preview.batch.blockers.map(blocker => blocker.message),
            ...warnings.map(warning => warning.message),
          ]),
          status: "error",
        };
      }
      const committed = await commissionerApi.commitHistory(
        preview.batch.id,
        seasonId,
        sheet.seasonYear,
      );
      const count = committed.committedRecords.length;
      const slotLabel = count === 1 ? "slot" : "slots";
      const [firstWarning] = warnings;
      const imported = `${String(count)} ${slotLabel} imported.`;
      return {
        seasonYear: sheet.seasonYear,
        message: firstWarning === undefined ? imported : `${imported} ${firstWarning.message}`,
        status: "imported",
      };
    } catch (error) {
      return { seasonYear: sheet.seasonYear, message: errorMessage(error), status: "error" };
    } finally {
      setCompleted(current => current + 1);
    }
  };

  const importSheets = useMutation({
    // Each commit recalibrates league pricing and re-syncs the unopened draft
    // room, so the years go one at a time rather than racing each other.
    mutationFn: async (
      sheets: readonly SlotPriceSeasonSheet[],
    ): Promise<readonly SlotPriceImportOutcome[]> => {
      const outcomes: SlotPriceImportOutcome[] = [];
      for (const sheet of sheets) outcomes.push(await importOne(sheet));
      return outcomes;
    },
    onSuccess: outcomes => {
      if (outcomes.some(outcome => outcome.status === "imported")) {
        void queryClient.invalidateQueries({
          queryKey: seasonQueryKeys.commissionerHistoricalImports(seasonId),
        });
      }
    },
  });

  const total = importSheets.variables?.length ?? 0;
  return {
    isPending: importSheets.isPending,
    outcomes: importSheets.data ?? [],
    percent: total === 0 ? 0 : (completed / total) * 100,
    reset: () => { importSheets.reset(); setCompleted(0); },
    start: (sheets: readonly SlotPriceSeasonSheet[]) => {
      setCompleted(0);
      importSheets.mutate(sheets);
    },
  };
};
