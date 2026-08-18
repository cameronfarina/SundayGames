import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useReducer, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { seasonQueryKeys } from "../../../../shared/api/queries/seasonQueryKeys";
import { Button, ProgressButton } from "../../../../shared/ui/index.js";
import { commissionerApi } from "../../api/commissionerApi";
import type { CommissionerSeason } from "../../api/seasonSchemas";
import { errorMessage } from "../../model/errorMessage";
import { fileBase64 } from "../../model/fileBase64";
import { historicalOwnerNeeds } from "../../model/historicalOwnerNeeds";
import {
  duplicateHistoricalYears,
  hasInvalidHistoricalYears,
  historicalYear,
  historicalQueueReducer,
  type HistoricalFileItem,
} from "../../model/historicalFileQueue";
import { HistoricalFileRow } from "./HistoricalFileRow.js";

interface HistoricalImportSectionProps { readonly season: CommissionerSeason }
interface ImportOutcome {
  readonly id: string; readonly message: string;
  readonly ownerNeeds?: readonly string[];
  readonly status: HistoricalFileItem["status"];
}
interface ImportProgress { readonly completed: number; readonly total: number }
interface ImportableFile { readonly item: HistoricalFileItem; readonly seasonYear: number }
const storedImportOptions = (seasonId: string, enabled: boolean) => queryOptions({
  queryKey: seasonQueryKeys.commissionerHistoricalImports(seasonId),
  queryFn: async () => await commissionerApi.historicalImports(seasonId),
  enabled,
});

export function HistoricalImportSection({ season }: HistoricalImportSectionProps) {
  const unavailable = season.settings.draftFormat === "snake";
  const queryClient = useQueryClient();
  const importedYears = useQuery(storedImportOptions(season.id, !unavailable));
  const [items, dispatch] = useReducer(historicalQueueReducer, []);
  const [replace, setReplace] = useState(false);
  const [keepersInFirstRow, setKeepersInFirstRow] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<ImportProgress>({ completed: 0, total: 0 });
  const fileInput = useRef<HTMLInputElement>(null);
  const pending = items.filter(item => item.status !== "imported");
  const importable = pending.flatMap(item => {
    const seasonYear = historicalYear(item.seasonYear);
    return seasonYear === undefined ? [] : [{ item, seasonYear }];
  });
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
      const committed = await commissionerApi.commitHistory(
        preview.batch.id,
        season.id,
        seasonYear,
      );
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
  const addFiles = (files: FileList | null) => {
    if (files !== null) dispatch({ type: "add", files: Array.from(files), currentYear: season.seasonYear });
  };
  const drop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files);
  };
  const changeFiles = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(event.target.files); event.target.value = "";
  };
  const duplicateYears = duplicateHistoricalYears(items);
  const invalidYears = hasInvalidHistoricalYears(items);
  const mappingIncomplete = pending.some(item => item.ownerNeeds.some(label => !item.ownerMappings[label]));
  const importedCount = importedYears.data?.seasonYears.length ?? 0;
  const percent = progress.total === 0 ? 0 : (progress.completed / progress.total) * 100;
  const fileLabel = pending.length === 1 ? "file" : "files";
  const importLabel = importFiles.isPending
    ? `Importing ${String(progress.completed)} of ${String(progress.total)} files`
    : `Import ${String(pending.length)} ${fileLabel}`;
  const startImport = () => {
    setProgress({ completed: 0, total: pending.length });
    importFiles.mutate(importable);
  };

  return (
    <section className="commissioner-section" id="draft-history">
      <header><div><span>02</span><h2>Draft history</h2></div><strong>{importedCount} imported</strong></header>
      {unavailable ? <p>Historical snake draft imports are not available yet.</p> : <>
        <p className="commissioner-help">Add prior auction results as CSV, TSV, or XLSX. Each file must use a different draft year.</p>
        <Button className={dragging ? "commissioner-dropzone is-dragging" : "commissioner-dropzone"}
          variant="secondary" onClick={() => { fileInput.current?.click(); }}
          onDragOver={event => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => { setDragging(false); }} onDrop={drop}>
          <strong>Drop draft files here</strong><span>CSV, TSV, or XLSX · 5 MB maximum each</span>
          <span>Choose files</span>
        </Button>
        <input aria-label="Choose historical draft files" className="commissioner-file-input" ref={fileInput}
          multiple type="file" onChange={changeFiles} accept=".csv,.tsv,.xlsx" />
        <div className="commissioner-list">
          {items.map(item => (
            <HistoricalFileRow dispatch={dispatch} item={item} key={item.id} teams={season.teams} />
          ))}
        </div>
        <label className="commissioner-check"><input type="checkbox" checked={replace} onChange={event => { setReplace(event.target.checked); }} />Replace an import for the same year</label>
        <label className="commissioner-check"><input type="checkbox" checked={keepersInFirstRow} onChange={event => { setKeepersInFirstRow(event.target.checked); }} />Roster row 1 contains each team&apos;s keeper</label>
        {duplicateYears ? <p role="alert">Choose a different draft year for each pending file.</p> : null}
        <ProgressButton
          busy={importFiles.isPending}
          disabled={pending.length === 0 || duplicateYears || invalidYears || mappingIncomplete}
          onClick={startImport}
          percent={percent}
        >
          {importLabel}
        </ProgressButton>
        {importFiles.isPending ? <p role="status">Reading and importing draft files.</p> : null}
      </>}
    </section>
  );
}
