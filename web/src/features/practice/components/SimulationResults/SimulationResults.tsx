import type {
  PracticeSimulationRun,
  PracticeSimulationSummary,
} from "../../api/simulationSchema";
import { PracticeSelect } from "../PracticeSelect/PracticeSelect";
import { TeamCard } from "./TeamCard";
import "./SimulationResults.css";

interface SimulationResultsProps {
  readonly note: string | undefined;
  readonly onRunChange: (runNumber: number) => void;
  readonly pendingRun: boolean;
  readonly run: PracticeSimulationRun | undefined;
  readonly selectedRunNumber: number;
  readonly summary: PracticeSimulationSummary;
}

const targetOutcomes = (summary: PracticeSimulationSummary) => {
  if (summary.targetOutcomes !== undefined) return summary.targetOutcomes;
  return summary.targetOutcome === undefined ? [] : [summary.targetOutcome];
};

export function SimulationResults(props: SimulationResultsProps) {
  const outcomes = targetOutcomes(props.summary);
  const runOptions = Array.from({ length: props.summary.runCount }, (_, index) => ({
    label: `Run ${String(index + 1)}`,
    value: String(index + 1),
  }));
  const teams = props.run === undefined
    ? []
    : [...props.run.teams].sort((left, right) => Number(right.isUserTeam) - Number(left.isUserTeam));

  return (
    <section aria-labelledby="simulation-results-title" className="simulation-results">
      <div className="simulation-results__heading">
        <div><p className="practice-eyebrow">Results</p><h2 id="simulation-results-title">League outcomes</h2></div>
        {runOptions.length > 0 && <PracticeSelect
          label="Simulation run"
          onValueChange={value => { props.onRunChange(Number(value)); }}
          options={runOptions}
          value={String(props.selectedRunNumber)}
        />}
      </div>
      <p className="simulation-results__summary">{props.summary.strategy.summary}</p>
      {props.summary.strategy.warnings.length > 0 && <ul className="simulation-results__warnings">
        {props.summary.strategy.warnings.map(warning => <li key={warning}>{warning}</li>)}
      </ul>}
      <dl className="simulation-results__metrics">
        <div><dt>Completed</dt><dd>{String(props.summary.completedCount)} / {String(props.summary.runCount)}</dd></div>
        <div><dt>Target hit rates</dt><dd>{outcomes.length === 0
          ? "No named targets"
          : outcomes.map(outcome => `${String(Math.round(outcome.hitRate * 100))}% ${outcome.playerName}`).join(" · ")}</dd></div>
        <div><dt>Format</dt><dd>{props.summary.draftFormat === "auction" ? "Auction" : "Snake"}</dd></div>
      </dl>
      {props.note !== undefined && props.note.length > 0 && <div className="simulation-results__note"><strong>Run note</strong><p>{props.note}</p></div>}
      <details className="simulation-results__exposure">
        <summary>Player exposure across all runs</summary>
        <table><thead><tr><th>Player</th><th>Pos</th><th>Exposure</th><th>Average</th></tr></thead>
          <tbody>{props.summary.playerExposure.map(player => <tr key={player.playerId}>
            <td>{player.playerName}</td><td>{player.position}</td><td>{Math.round(player.rate * 100)}%</td>
            <td>{player.averagePrice === undefined
              ? player.averagePick === undefined ? "-" : `Pick ${player.averagePick.toFixed(1)}`
              : `$${player.averagePrice.toFixed(1)}`}</td>
          </tr>)}</tbody>
        </table>
      </details>
      {props.pendingRun
        ? <p role="status">Loading Run {String(props.selectedRunNumber)}…</p>
        : teams.length === 0
        ? <p className="practice-empty">No roster results were returned.</p>
        : <div className="simulation-results__teams">{teams.map(team => <TeamCard key={team.teamId} team={team} />)}</div>}
    </section>
  );
}
