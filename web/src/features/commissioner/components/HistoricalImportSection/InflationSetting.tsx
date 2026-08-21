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
    <aside className="history-inflation">
      <h3>No data? No problem.</h3>
      <strong className="history-inflation__label">Set inflation by hand</strong>
      <p className="commissioner-help">
        Estimate what your league pays compared with market prices. For example, 120% means your
        league pays about a fifth more than the published board. This estimate is used only when
        imported results cannot be compared with a market value.
      </p>
      {importedYearCount > 0 ? (
        <p className="commissioner-help">
          You have {importedYearCount} draft {importedYearCount === 1 ? "year" : "years"} imported.
          Those results take priority. This percentage is used only when no imported sale can be
          compared with a market value.
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
    </aside>
  );
}
