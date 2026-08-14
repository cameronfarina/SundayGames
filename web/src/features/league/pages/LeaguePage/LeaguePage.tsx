import { useSearchParams } from "react-router-dom";
import { DraftStatus } from "../../components/DraftStatus/DraftStatus";
import { LeagueHeader } from "../../components/LeagueHeader/LeagueHeader";
import { LeagueSettings } from "../../components/LeagueSettings/LeagueSettings";
import { LeagueError, LeagueLoading, NoLeague, StaleLeague } from "../../components/LeagueState/LeagueState";
import { LeagueTeams } from "../../components/LeagueTeams/LeagueTeams";
import { TeamClaimPanel } from "../../components/TeamClaimPanel/TeamClaimPanel";
import { useLeaguePageData } from "../../hooks/useLeaguePageData";
import "./LeaguePage.css";

export function LeaguePage() {
  const [search] = useSearchParams();
  const requestedSeasonId = search.get("seasonId");
  const data = useLeaguePageData(requestedSeasonId);

  if (data.onboarding.isPending) return <LeagueLoading />;
  if (data.onboarding.error !== null) {
    return <LeagueError error={data.onboarding.error} retry={() => void data.onboarding.refetch()} />;
  }
  if (data.onboarding.data.leagues.length === 0) return <NoLeague />;
  if (data.selectedLeague === undefined) return <StaleLeague />;
  if (data.season.isPending || data.keepers.isPending) return <LeagueLoading />;
  if (data.season.error !== null) return <LeagueError error={data.season.error} />;
  if (data.keepers.error !== null) return <LeagueError error={data.keepers.error} />;

  const league = data.selectedLeague;
  const season = data.season.data.season;
  const needsClaim = league.membership.teamId === undefined;

  return (
    <div className="league-page">
      <LeagueHeader league={league} />
      {needsClaim ? (
        <TeamClaimPanel seasonId={league.seasonId} teams={data.season.data.claimableTeams} />
      ) : null}
      <LeagueSettings season={season} />
      <DraftStatus league={league} />
      <LeagueTeams teams={season.teams} keepers={data.keepers.data.keepers} />
    </div>
  );
}
