import { useState } from "react";
import { InlineNotice } from "../../../../shared/ui";
import { useLeagueConnectionDetailQuery } from "../../hooks/useLeagueConnectionQueries";
import { formatSyncedAt, statusMessage } from "../../lib/connectionStatus";
import { LeagueSettingsSummary } from "./LeagueSettingsSummary";
import { MatchupTable } from "./MatchupTable";
import { TeamRoster } from "./TeamRoster";
import "./LeagueDetail.css";

type DetailView = "teams" | "matchups";

interface LeagueDetailProps {
  readonly connectionId: string;
}

export const LeagueDetail = ({ connectionId }: LeagueDetailProps) => {
  const [view, setView] = useState<DetailView>("teams");
  const detail = useLeagueConnectionDetailQuery(connectionId);

  if (detail.isPending) return <p role="status">Loading league...</p>;
  if (detail.isError) return <InlineNotice variant="error">{detail.error.message}</InlineNotice>;

  const { connection, league } = detail.data;
  if (league === null) {
    return <section aria-labelledby="league-detail-title" className="league-detail">
      <h2 id="league-detail-title">{connection.displayName}</h2>
      <InlineNotice variant="warning">
        {statusMessage(connection.status, connection.statusDetail)}
      </InlineNotice>
    </section>;
  }

  return <section aria-labelledby="league-detail-title" className="league-detail">
    <header className="league-detail__header">
      <h2 id="league-detail-title">{league.settings.name}</h2>
      <span>{formatSyncedAt(league.syncedAt)}</span>
    </header>
    <LeagueSettingsSummary settings={league.settings} />
    <div aria-label="League views" className="league-detail__tabs" role="tablist">
      <button
        aria-selected={view === "teams"}
        onClick={() => { setView("teams"); }}
        role="tab"
        type="button"
      >Teams ({league.teams.length})</button>
      <button
        aria-selected={view === "matchups"}
        onClick={() => { setView("matchups"); }}
        role="tab"
        type="button"
      >Matchups ({league.matchups.length})</button>
    </div>
    {view === "teams"
      ? <div className="league-detail__teams">
        {league.teams.map(team => <TeamRoster key={team.providerTeamId} team={team} />)}
      </div>
      : <MatchupTable matchups={league.matchups} teams={league.teams} />}
  </section>;
};
