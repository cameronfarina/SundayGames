import { useState } from "react";
import type { PracticeSimulation } from "../../api/simulationSchema";
import { PracticeSelect } from "../PracticeSelect/PracticeSelect";
import { TeamCard } from "./TeamCard";
import "./SimulationResults.css";

interface SimulationResultsProps {
  readonly note: string | undefined;
  readonly simulation: PracticeSimulation;
}

const targetOutcomes = (simulation: PracticeSimulation) => {
  if (simulation.targetOutcomes !== undefined) return simulation.targetOutcomes;
  return simulation.targetOutcome === undefined ? [] : [simulation.targetOutcome];
};

export function SimulationResults({ note, simulation }: SimulationResultsProps) {
  const [selectedRun, setSelectedRun] = useState(0);
  const run = simulation.runs[selectedRun] ?? simulation.runs[0];
  const outcomes = targetOutcomes(simulation);
  const runOptions = simulation.runs.map((item, index) => ({ label: item.label, value: String(index) }));
  const teams = run === undefined
    ? []
    : [...run.teams].sort((left, right) => Number(right.isUserTeam) - Number(left.isUserTeam));

  return (
    <section aria-labelledby="simulation-results-title" className="simulation-results">
      <div className="simulation-results__heading">
        <div><p className="practice-eyebrow">Results</p><h2 id="simulation-results-title">League outcomes</h2></div>
        {runOptions.length > 0 && <PracticeSelect
          label="Simulation run"
          onValueChange={value => { setSelectedRun(Number(value)); }}
          options={runOptions}
          value={String(selectedRun)}
        />}
      </div>
      <p className="simulation-results__summary">{simulation.strategy.summary}</p>
      {simulation.strategy.warnings.length > 0 && <ul className="simulation-results__warnings">
        {simulation.strategy.warnings.map(warning => <li key={warning}>{warning}</li>)}
      </ul>}
      <dl className="simulation-results__metrics">
        <div><dt>Completed</dt><dd>{String(simulation.completedCount)} / {String(simulation.runCount)}</dd></div>
        <div><dt>Target hit rates</dt><dd>{outcomes.length === 0
          ? "No named targets"
          : outcomes.map(outcome => `${String(Math.round(outcome.hitRate * 100))}% ${outcome.playerName}`).join(" · ")}</dd></div>
        <div><dt>Format</dt><dd>{simulation.draftFormat === "auction" ? "Auction" : "Snake"}</dd></div>
      </dl>
      {note !== undefined && note.length > 0 && <div className="simulation-results__note"><strong>Run note</strong><p>{note}</p></div>}
      <details className="simulation-results__exposure">
        <summary>Player exposure across all runs</summary>
        <table><thead><tr><th>Player</th><th>Pos</th><th>Exposure</th><th>Average</th></tr></thead>
          <tbody>{simulation.playerExposure.map(player => <tr key={player.playerId}>
            <td>{player.playerName}</td><td>{player.position}</td><td>{Math.round(player.rate * 100)}%</td>
            <td>{player.averagePrice === undefined
              ? player.averagePick === undefined ? "-" : `Pick ${player.averagePick.toFixed(1)}`
              : `$${player.averagePrice.toFixed(1)}`}</td>
          </tr>)}</tbody>
        </table>
      </details>
      {teams.length === 0
        ? <p className="practice-empty">No roster results were returned.</p>
        : <div className="simulation-results__teams">{teams.map(team => <TeamCard key={team.teamId} team={team} />)}</div>}
    </section>
  );
}
