import { Select, type SelectOption } from "../../../../shared/ui";
import type { ImportMode } from "../../lib/importRequest";

interface ImportTargetProps {
  readonly leagues: readonly SelectOption[];
  readonly mode: ImportMode;
  readonly note: string | undefined;
  readonly onModeChange: (mode: ImportMode) => void;
  readonly onSeasonIdChange: (seasonId: string) => void;
  readonly seasonId: string | undefined;
}

export const ImportTarget = ({
  leagues,
  mode,
  note,
  onModeChange,
  onSeasonIdChange,
  seasonId,
}: ImportTargetProps) => <div className="import-target">
  <fieldset className="import-target__modes">
    <legend>What should this import build?</legend>
    <label>
      <input
        checked={mode === "create"}
        name="import-mode"
        onChange={() => { onModeChange("create"); }}
        type="radio"
      />
      A new Sunday Games league
    </label>
    <label>
      <input
        checked={mode === "overwrite"}
        disabled={leagues.length === 0}
        name="import-mode"
        onChange={() => { onModeChange("overwrite"); }}
        type="radio"
      />
      A league you already run, replaced
    </label>
  </fieldset>
  {note === undefined ? null : <p className="import-target__note">{note}</p>}
  {mode === "create" ? null : <Select
    id="import-target-league"
    label="League to replace"
    onValueChange={onSeasonIdChange}
    options={leagues}
    placeholder="Choose a league"
    {...(seasonId === undefined ? {} : { value: seasonId })}
  />}
</div>;
