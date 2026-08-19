import type { SyncedLeague } from "../../api/leagueConnectionsSchema";

interface LeagueSettingsSummaryProps {
  readonly settings: SyncedLeague["settings"];
}

const startingSlots = (rosterPositions: readonly string[]): string =>
  rosterPositions.filter(position => position !== "BN" && position !== "IR").join(", ");

export const LeagueSettingsSummary = ({ settings }: LeagueSettingsSummaryProps) => {
  const scoring = Object.entries(settings.scoring);

  return <dl className="league-settings">
    <div><dt>Teams</dt><dd>{settings.teamCount}</dd></div>
    <div><dt>Starting lineup</dt><dd>{startingSlots(settings.rosterPositions)}</dd></div>
    {settings.playoffTeams === undefined
      ? null
      : <div><dt>Playoff teams</dt><dd>{settings.playoffTeams}</dd></div>}
    {settings.playoffWeekStart === undefined
      ? null
      : <div><dt>Playoffs start</dt><dd>Week {settings.playoffWeekStart}</dd></div>}
    {settings.waiverBudget === undefined
      ? null
      : <div><dt>Waiver budget</dt><dd>${settings.waiverBudget}</dd></div>}
    {scoring.length === 0
      ? null
      : <div>
        <dt>Scoring</dt>
        <dd>{scoring.map(([stat, points]) => `${stat} ${String(points)}`).join(" · ")}</dd>
      </div>}
  </dl>;
};
