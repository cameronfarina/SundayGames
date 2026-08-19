import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { invalidateLeagueSetupConsumers } from "../../../../shared/api/queries/seasonQueryInvalidation";
import { Button, NumberField } from "../../../../shared/ui/index.js";
import { commissionerApi } from "../../api/commissionerApi";
import type { CommissionerSeason } from "../../api/seasonSchemas";
import { errorMessage } from "../../model/errorMessage";
import { inflationPercentError, savedInflationPercent } from "../../model/inflationPercent";

interface InflationSettingProps {
  readonly importedYearCount: number;
  readonly season: CommissionerSeason;
}

export function InflationSetting({ importedYearCount, season }: InflationSettingProps) {
  const queryClient = useQueryClient();
  const saved = savedInflationPercent(season.settings.manualInflationMultiplier);
  const [percent, setPercent] = useState(saved);
  const save = useMutation({
    mutationFn: async (value: number | undefined) => {
      const result = await commissionerApi.setInflation(season.id, value);
      await invalidateLeagueSetupConsumers(queryClient, season.id);
      return result;
    },
  });
  const error = inflationPercentError(percent);
  const errorProps = error === undefined ? {} : { error };
  const empty = percent.trim().length === 0;
  const unchanged = percent.trim() === saved.trim();

  return (
    <details className="commissioner-paste">
      <summary>Set an inflation percentage by hand</summary>
      <p className="commissioner-help">
        Say what your league pays compared with published market prices. 120% means the room
        pays about a fifth more than the published board. This is only used when no imported
        sale can be matched to a published value, so importing real draft results always takes
        over from it.
      </p>
      {importedYearCount > 0 ? (
        <p className="commissioner-help">
          You have {importedYearCount} draft {importedYearCount === 1 ? "year" : "years"} imported.
          Those results lead, and this percentage applies only if none of them can be priced
          against the published board.
        </p>
      ) : null}
      <NumberField
        id="commissioner-inflation-percent"
        label="Inflation percentage"
        max={1000}
        min={1}
        {...errorProps}
        onChange={event => { setPercent(event.target.value); save.reset(); }}
        step={1}
        value={percent}
      />
      <div className="commissioner-actions">
        <Button
          aria-busy={save.isPending}
          disabled={save.isPending || error !== undefined || unchanged || empty}
          onClick={() => { save.mutate(Number(percent.trim())); }}
        >
          {save.isPending ? "Saving..." : "Save percentage"}
        </Button>
        <Button
          disabled={save.isPending || saved.length === 0}
          onClick={() => { setPercent(""); save.mutate(undefined); }}
          variant="secondary"
        >
          Clear
        </Button>
      </div>
      {save.isSuccess ? <p role="status">Inflation percentage saved.</p> : null}
      {save.isError ? <p role="alert">{errorMessage(save.error)}</p> : null}
    </details>
  );
}
