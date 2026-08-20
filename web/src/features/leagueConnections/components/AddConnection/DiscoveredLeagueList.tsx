import { Button, Select } from "../../../../shared/ui";
import type { DiscoveredLeague } from "../../api/leagueConnectionsSchema";
import {
  newLeagueImportTarget,
  type LeagueImportState,
} from "../../hooks/useAddConnectionForm";

export interface LeagueImportTarget {
  readonly leagueName: string;
  readonly seasonId: string;
  readonly seasonYear: number;
}

interface DiscoveredLeagueListProps {
  readonly leagues: readonly DiscoveredLeague[];
  readonly onConnect: (league: DiscoveredLeague) => void;
  readonly onConnectAll: () => void;
  readonly onTargetChange: (league: DiscoveredLeague, targetSeasonId: string) => void;
  readonly pending: boolean;
  readonly states: Record<string, LeagueImportState>;
  readonly targetSeasonIds: Record<string, string>;
  readonly targets: readonly LeagueImportTarget[];
}

const keyFor = (league: DiscoveredLeague): string => `${league.providerLeagueId}:${league.season}`;
const labelFor = (state: LeagueImportState): string => {
  if (state.status === "importing") return "Importing...";
  if (state.status === "imported") return "Imported";
  if (state.status === "linked") return "Already linked";
  if (state.status === "error") return state.message ?? "Import failed";
  return "Ready to import";
};

export const DiscoveredLeagueList = ({
  leagues,
  onConnect,
  onConnectAll,
  onTargetChange,
  pending,
  states,
  targetSeasonIds,
  targets,
}: DiscoveredLeagueListProps) => {
  if (leagues.length === 0) return null;
  const allDone = leagues.every(league => {
    const status = states[keyFor(league)]?.status;
    return status === "imported" || status === "linked";
  });

  return <>
    <ul aria-label="Leagues found" className="add-connection__results">
      {leagues.map(league => {
        const key = keyFor(league);
        const state = states[key] ?? { status: "idle" };
        const done = state.status === "imported" || state.status === "linked";
        const seasonYear = Number(league.season);
        const options = [
          { value: newLeagueImportTarget, label: "Create a new Sunday Games league" },
          ...targets
            .filter(target => target.seasonYear === seasonYear)
            .map(target => ({
              value: target.seasonId,
              label: `Overwrite ${target.leagueName}`,
            })),
        ];
        return <li key={league.providerLeagueId}>
          <div className="add-connection__result-copy">
            <p className="add-connection__result-name">{league.name}</p>
            <span>{league.season} season · {league.teamCount} teams</span>
            <span>{labelFor(state)}</span>
          </div>
          <div className="add-connection__result-actions">
            {options.length > 1 ? <Select
              disabled={pending || done}
              id={`import-target-${league.providerLeagueId}`}
              label="Import destination"
              onValueChange={value => { onTargetChange(league, value); }}
              options={options}
              value={targetSeasonIds[key] ?? newLeagueImportTarget}
            /> : null}
            <Button
              disabled={pending || state.status === "importing" || done}
              onClick={() => { onConnect(league); }}
              variant="secondary"
            >
              {state.status === "error" ? `Retry ${league.name}` : `Import ${league.name}`}
            </Button>
          </div>
        </li>;
      })}
    </ul>
    <Button disabled={pending || allDone} onClick={onConnectAll}>Import all leagues</Button>
  </>;
};
