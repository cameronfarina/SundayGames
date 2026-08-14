import type { LeagueSeason } from "../../api/leagueSchemas";
import { describeDraft, describeRoster, describeScoring } from "../../lib/leagueDisplay";

export function LeagueSettings({ season }: { readonly season: LeagueSeason }) {
  return (
    <section className="league-section" aria-labelledby="league-settings-title">
      <h2 id="league-settings-title">League settings</h2>
      <dl className="league-facts">
        <div><dt>Draft</dt><dd>{describeDraft(season.settings)}</dd></div>
        <div><dt>Scoring</dt><dd>{describeScoring(season.settings)}</dd></div>
        <div><dt>Roster</dt><dd>{describeRoster(season.settings)}</dd></div>
      </dl>
    </section>
  );
}
