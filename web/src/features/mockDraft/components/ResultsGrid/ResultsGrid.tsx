import type { MockResults } from "../../api/mockDraftSchemas.js";
import { ResultTeamCard } from "./ResultTeamCard.js";
import "./ResultsGrid.css";

interface ResultsGridProps {
  readonly results: MockResults;
}

const coverageMessage = (results: MockResults): string =>
  results.projectedPlayerCount === results.rosteredPlayerCount
    ? `Week 1 estimates available for all ${String(results.rosteredPlayerCount)} rostered players.`
    : `Week 1 estimates available for ${String(results.projectedPlayerCount)} of ${String(results.rosteredPlayerCount)} rostered players.`;

export const ResultsGrid = ({ results }: ResultsGridProps) => (
  <section aria-labelledby="mock-results-heading" className="results-grid-section">
    <div className="results-grid-section__heading">
      <div>
        <span>Mock complete</span>
        <h2 id="mock-results-heading">League results</h2>
      </div>
      <p>{coverageMessage(results)}</p>
    </div>
    <div className="results-grid">
      {results.teams.map(team => <ResultTeamCard key={team.teamId} team={team} />)}
    </div>
  </section>
);
