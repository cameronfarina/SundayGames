import { useState } from "react";
import { NumberField, ProgressButton } from "../../../../shared/ui/index.js";
import type { CommissionerSeason } from "../../api/seasonSchemas";
import { historicalYear, historicalYearError } from "../../model/historicalFileQueue";
import { slotPriceSeasonSheets } from "../../model/slotPriceSeasons";
import { useSlotPriceImportRun } from "./useSlotPriceImportRun.js";

interface SlotPriceImportProps { readonly season: CommissionerSeason }

export function SlotPriceImport({ season }: SlotPriceImportProps) {
  const [sourceText, setSourceText] = useState("");
  const [year, setYear] = useState(String(season.seasonYear - 1));
  const [replace, setReplace] = useState(false);
  const run = useSlotPriceImportRun({ replace, seasonId: season.id });
  const fallbackYear = historicalYear(year);
  const sheets = fallbackYear === undefined
    ? []
    : slotPriceSeasonSheets(sourceText, fallbackYear);
  const yearError = historicalYearError(year);
  const errorProps = yearError === undefined ? {} : { error: yearError };
  const seasonLabel = sheets.length === 1 ? "draft year" : "draft years";
  const importLabel = run.isPending
    ? "Importing slot prices"
    : `Import ${String(sheets.length)} ${seasonLabel}`;

  return (
    <details className="commissioner-paste">
      <summary>Advanced price import</summary>
      <p className="commissioner-help">
        If you do not have complete draft results, paste Position, Rank, Price rows. Add a Season
        column or one price column per year to import several drafts. No owner or player names are
        required.
      </p>
      <p className="commissioner-help">
        SundayGames matches each row to the published ESPN board. Kickers, defenses, and slots
        sold for $1 or $2 are saved but do not change pricing.
      </p>
      <p className="commissioner-help">Example: <code>Position,Rank,Price</code> then <code>RB,1,75</code></p>
      <label htmlFor="commissioner-slot-prices">Slot prices</label>
      <textarea
        id="commissioner-slot-prices"
        onChange={event => { setSourceText(event.target.value); run.reset(); }}
        rows={8}
        value={sourceText}
      />
      <NumberField
        id="commissioner-slot-year"
        label="Draft year for this paste"
        max={2100}
        min={2000}
        {...errorProps}
        onChange={event => { setYear(event.target.value); run.reset(); }}
        step={1}
        value={year}
      />
      <p className="commissioner-help">Used only when the paste does not name its own years.</p>
      <label className="commissioner-check">
        <input
          type="checkbox"
          checked={replace}
          onChange={event => { setReplace(event.target.checked); }}
        />
        Replace slot prices for the same year
      </label>
      <ProgressButton
        busy={run.isPending}
        disabled={sheets.length === 0 || run.isPending}
        onClick={() => { run.start(sheets); }}
        percent={run.percent}
      >
        {importLabel}
      </ProgressButton>
      {run.isPending ? <p role="status">Importing slot prices one draft year at a time.</p> : null}
      <ul className="commissioner-slot-results">
        {run.outcomes.map(outcome => (
          <li key={outcome.seasonYear} role={outcome.status === "error" ? "alert" : "status"}>
            {outcome.seasonYear}: {outcome.message}
          </li>
        ))}
      </ul>
    </details>
  );
}
