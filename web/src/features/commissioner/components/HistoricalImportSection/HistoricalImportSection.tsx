import { queryOptions, useQuery } from "@tanstack/react-query";
import { useReducer, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { seasonQueryKeys } from "../../../../shared/api/queries/seasonQueryKeys";
import { Button, ProgressButton } from "../../../../shared/ui/index.js";
import { commissionerApi } from "../../api/commissionerApi";
import type { CommissionerSeason } from "../../api/seasonSchemas";
import {
  duplicateHistoricalYears,
  hasInvalidHistoricalYears,
  historicalYear,
  historicalQueueReducer,
} from "../../model/historicalFileQueue";
import { HistoricalFileRow } from "./HistoricalFileRow.js";
import { InflationSetting } from "./InflationSetting.js";
import { SlotPriceImport } from "./SlotPriceImport.js";
import { useHistoricalImportRun } from "./useHistoricalImportRun.js";

interface HistoricalImportSectionProps { readonly season: CommissionerSeason }
const storedImportOptions = (seasonId: string, enabled: boolean) => queryOptions({
  queryKey: seasonQueryKeys.commissionerHistoricalImports(seasonId),
  queryFn: async () => await commissionerApi.historicalImports(seasonId),
  enabled,
});

export function HistoricalImportSection({ season }: HistoricalImportSectionProps) {
  const unavailable = season.settings.draftFormat === "snake";
  const importedYears = useQuery(storedImportOptions(season.id, !unavailable));
  const [items, dispatch] = useReducer(historicalQueueReducer, []);
  const [replace, setReplace] = useState(false);
  const [keepersInFirstRow, setKeepersInFirstRow] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const run = useHistoricalImportRun({ dispatch, keepersInFirstRow, replace, season });
  const pending = items.filter(item => item.status !== "imported");
  const importable = pending.flatMap(item => {
    const seasonYear = historicalYear(item.seasonYear);
    return seasonYear === undefined ? [] : [{ item, seasonYear }];
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
  const fileLabel = pending.length === 1 ? "file" : "files";
  const importLabel = run.isPending
    ? `Importing ${String(run.progress.completed)} of ${String(run.progress.total)} files`
    : `Import ${String(pending.length)} ${fileLabel}`;

  return (
    <section className="commissioner-section" id="draft-history">
      <header><h2>Historical pricing</h2><strong>{importedCount} imported</strong></header>
      {unavailable ? <p>Historical snake draft imports are not available yet.</p> : <>
        <p className="commissioner-help">Teach SundayGames how your league spends using past auction data.</p>
        <p className="commissioner-help">
          Have complete draft results? Upload CSV, TSV, or XLSX files with Owner, Player, Position,
          and Price. Add Public Value to say what the market asked for that player, or leave it out
          and we read it from the published ESPN board. An ESPN-style sheet with a Team header row
          and a price, position, and player column per team works as it is. Each file must use a
          different draft year.
        </p>
        <p className="commissioner-help">
          Only track what each positional rank costs? Use <strong>Paste positional price history</strong>
          below. No owner or player names are required. Use Position, Rank, Price, for example
          RB, 1, 75.
        </p>
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
          busy={run.isPending}
          disabled={pending.length === 0 || duplicateYears || invalidYears || mappingIncomplete}
          onClick={() => { run.start(importable, pending.length); }}
          percent={run.percent}
        >
          {importLabel}
        </ProgressButton>
        {run.isPending ? <p role="status">Reading and importing draft files.</p> : null}
        <SlotPriceImport season={season} />
        <InflationSetting importedYearCount={importedCount} season={season} />
      </>}
    </section>
  );
}
