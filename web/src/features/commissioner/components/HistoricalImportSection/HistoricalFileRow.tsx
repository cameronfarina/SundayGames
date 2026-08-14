import type { Dispatch } from "react";
import { Button, NumberField, Select } from "../../../../shared/ui/index.js";
import type { CommissionerSeason } from "../../api/seasonSchemas.js";
import {
  historicalYearError,
  type HistoricalFileItem,
  type HistoricalQueueAction,
} from "../../model/historicalFileQueue.js";

interface HistoricalFileRowProps {
  readonly dispatch: Dispatch<HistoricalQueueAction>;
  readonly item: HistoricalFileItem;
  readonly teams: CommissionerSeason["teams"];
}

const mappingId = (itemId: string, label: string): string =>
  `${itemId}-mapping-${label.replaceAll(" ", "-")}`;

export const HistoricalFileRow = ({ dispatch, item, teams }: HistoricalFileRowProps) => {
  const yearError = historicalYearError(item.seasonYear);
  const errorProps = yearError === undefined ? {} : { error: yearError };
  return <div className="history-file">
    <span className="history-file__summary">
      <strong>{item.file.name}</strong>
      <small>{item.message}</small>
    </span>
    <NumberField
      disabled={item.status === "imported"}
      id={`${item.id}-year`}
      label="Draft year"
      max={2100}
      min={2000}
      {...errorProps}
      onChange={event => {
        dispatch({ id: item.id, seasonYear: event.target.value, type: "year" });
      }}
      step={1}
      value={item.seasonYear}
    />
    <Button
      disabled={item.status === "imported"}
      onClick={() => { dispatch({ id: item.id, type: "remove" }); }}
      variant="secondary"
    >
      Remove
    </Button>
    {item.ownerNeeds.map(label => (
      <div className="history-mapping" key={label}>
        <Select
          id={mappingId(item.id, label)}
          label={`Historical team: ${label}`}
          onValueChange={teamId => {
            dispatch({ id: item.id, label, teamId, type: "mapping" });
          }}
          options={teams.map(team => ({ label: team.displayName, value: team.id }))}
          placeholder="Choose current team"
          value={item.ownerMappings[label] ?? ""}
        />
      </div>
    ))}
  </div>;
};
