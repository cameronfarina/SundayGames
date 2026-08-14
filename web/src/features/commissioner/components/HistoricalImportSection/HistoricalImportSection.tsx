import { useMutation } from "@tanstack/react-query";
import { useReducer, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { commissionerApi } from "../../api/commissionerApi";
import type { CommissionerSeason } from "../../api/seasonSchemas";
import { errorMessage } from "../../model/errorMessage";
import { fileBase64 } from "../../model/fileBase64";
import {
  duplicateHistoricalYears,
  historicalQueueReducer,
  type HistoricalFileItem,
} from "../../model/historicalFileQueue";

interface HistoricalImportSectionProps { readonly season: CommissionerSeason }

interface ImportOutcome {
  readonly id: string;
  readonly message: string;
  readonly ownerNeeds?: readonly string[];
  readonly status: HistoricalFileItem["status"];
}

const ownerNeedsFor = (item: HistoricalFileItem, rows: readonly {
  readonly blockers: readonly { readonly code: string }[];
  readonly identityAudit?: { readonly sourceOwnerOrTeamLabel: string } | undefined;
}[]): readonly string[] => [...new Set(rows.flatMap(row => {
  const needsMapping = row.blockers.some(blocker =>
    blocker.code === "owner_unknown" || blocker.code === "owner_ambiguous");
  return needsMapping && row.identityAudit !== undefined
    ? [row.identityAudit.sourceOwnerOrTeamLabel]
    : [];
}))].filter(label => item.ownerMappings[label] === undefined);

export function HistoricalImportSection({ season }: HistoricalImportSectionProps) {
  const [items, dispatch] = useReducer(historicalQueueReducer, []);
  const [replace, setReplace] = useState(false);
  const [keepersInFirstRow, setKeepersInFirstRow] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const importFiles = useMutation({
    mutationFn: async (pending: readonly HistoricalFileItem[]): Promise<readonly ImportOutcome[]> =>
      await Promise.all(pending.map(async item => {
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
            seasonYear: item.seasonYear,
          });
          const ownerNeeds = ownerNeedsFor(item, preview.batch.rows);
          if (preview.batch.status === "blocked") {
            const messages = preview.batch.blockers.map(blocker => blocker.message);
            return {
              id: item.id,
              message: ownerNeeds.length > 0 ? "Match historical teams below, then import again." : messages.join(" "),
              ownerNeeds,
              status: ownerNeeds.length > 0 ? "mapping" : "error",
            };
          }
          const committed = await commissionerApi.commitHistory(preview.batch.id, season.id, item.seasonYear);
          return { id: item.id, message: `${String(committed.committedRecords.length)} players imported`, status: "imported" };
        } catch (error) {
          return { id: item.id, message: errorMessage(error), status: "error" };
        }
      })),
    onSuccess: outcomes => { outcomes.forEach(outcome => { dispatch({ type: "result", ...outcome }); }); },
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
  const pending = items.filter(item => item.status !== "imported");
  const duplicateYears = duplicateHistoricalYears(items);
  const mappingIncomplete = pending.some(item => item.ownerNeeds.some(label => !item.ownerMappings[label]));
  const unavailable = season.settings.draftFormat === "snake";

  return (
    <section className="commissioner-section" id="draft-history">
      <header><div><span>03</span><h2>Draft history</h2></div><strong>{items.filter(item => item.status === "imported").length} imported</strong></header>
      {unavailable ? <p>Historical snake draft imports are not available yet.</p> : <>
        <p className="commissioner-help">Add prior auction results as CSV, TSV, or XLSX. Each file must use a different draft year.</p>
        <button className={dragging ? "commissioner-dropzone is-dragging" : "commissioner-dropzone"}
          type="button" onClick={() => { fileInput.current?.click(); }}
          onDragOver={event => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => { setDragging(false); }} onDrop={drop}>
          <strong>Drop draft files here</strong><span>CSV, TSV, or XLSX · 5 MB maximum each</span>
          <span>Choose files</span>
        </button>
        <input aria-label="Choose historical draft files" className="commissioner-file-input" ref={fileInput}
          multiple type="file" onChange={changeFiles} accept=".csv,.tsv,.xlsx" />
        <div className="commissioner-list">
          {items.map(item => <div className="history-file" key={item.id}>
            <span><strong>{item.file.name}</strong><small>{item.message}</small></span>
            <label>Draft year<input type="number" min="2000" max="2100" value={item.seasonYear}
              disabled={item.status === "imported"} onChange={event => {
                dispatch({ type: "year", id: item.id, seasonYear: event.target.valueAsNumber });
              }} /></label>
            <button type="button" onClick={() => { dispatch({ type: "remove", id: item.id }); }}>Remove</button>
            {item.ownerNeeds.map(label => <label className="history-mapping" key={label}>Historical team: {label}
              <select value={item.ownerMappings[label] ?? ""} onChange={event => {
                dispatch({ type: "mapping", id: item.id, label, teamId: event.target.value });
              }}><option value="">Choose current team</option>{season.teams.map(team =>
                <option key={team.id} value={team.id}>{team.displayName}</option>)}</select>
            </label>)}
          </div>)}
        </div>
        <label className="commissioner-check"><input type="checkbox" checked={replace} onChange={event => { setReplace(event.target.checked); }} />Replace an import for the same year</label>
        <label className="commissioner-check"><input type="checkbox" checked={keepersInFirstRow} onChange={event => { setKeepersInFirstRow(event.target.checked); }} />Roster row 1 contains each team&apos;s keeper</label>
        {duplicateYears ? <p role="alert">Choose a different draft year for each pending file.</p> : null}
        <button className="commissioner-primary" type="button" disabled={pending.length === 0 || duplicateYears || mappingIncomplete || importFiles.isPending}
          onClick={() => { importFiles.mutate(pending); }}>Import {pending.length} {pending.length === 1 ? "file" : "files"}</button>
        {importFiles.isPending ? <p role="status">Reading and importing draft files...</p> : null}
      </>}
    </section>
  );
}
