import type { SyncedLeague } from "../../api/leagueConnectionsSchema";
import { draftSummary, keeperSummary } from "../../lib/draftSummary";
import {
  allScoringRulesLabel,
  describeScoringRules,
  summarizeScoring,
} from "../../lib/scoringSummary";

interface LeagueSettingsSummaryProps {
  readonly settings: SyncedLeague["settings"];
}

const startingSlots = (rosterPositions: readonly string[]): string =>
  rosterPositions.filter(position => position !== "BN" && position !== "IR").join(", ");

export const LeagueSettingsSummary = ({ settings }: LeagueSettingsSummaryProps) => {
  const scoring = summarizeScoring(settings.scoring);
  const draft = draftSummary(settings);
  const keepers = keeperSummary(settings.keeperCount);

  return <dl className="league-settings">
    <div><dt>Teams</dt><dd>{settings.teamCount}</dd></div>
    <div><dt>Starting lineup</dt><dd>{startingSlots(settings.rosterPositions)}</dd></div>
    {draft === undefined ? null : <div><dt>Draft</dt><dd>{draft}</dd></div>}
    {keepers === undefined ? null : <div><dt>Keepers</dt><dd>{keepers}</dd></div>}
    {settings.playoffTeams === undefined
      ? null
      : <div><dt>Playoff teams</dt><dd>{settings.playoffTeams}</dd></div>}
    {settings.playoffWeekStart === undefined
      ? null
      : <div><dt>Playoffs start</dt><dd>Week {settings.playoffWeekStart}</dd></div>}
    {settings.waiverBudget === undefined
      ? null
      : <div><dt>Waiver budget</dt><dd>${settings.waiverBudget}</dd></div>}
    {scoring.all.length === 0
      ? null
      : <div className="league-settings__scoring-row">
        <dt>Scoring</dt>
        <dd>
          {scoring.headline.length === 0
            ? null
            : <p className="league-settings__scoring">{describeScoringRules(scoring.headline)}</p>}
          {scoring.all.length === scoring.headline.length
            ? null
            : <details className="league-settings__scoring-all">
              <summary>{allScoringRulesLabel(scoring.all)}</summary>
              <p>{describeScoringRules(scoring.all)}</p>
            </details>}
        </dd>
      </div>}
  </dl>;
};
