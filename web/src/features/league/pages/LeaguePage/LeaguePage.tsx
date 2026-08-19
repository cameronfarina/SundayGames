import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CreateLeagueWizard } from "../../../createLeague/components/CreateLeagueWizard/CreateLeagueWizard";
import { DraftStatus } from "../../components/DraftStatus/DraftStatus";
import { LeagueHeader } from "../../components/LeagueHeader/LeagueHeader";
import { LeagueSettings } from "../../components/LeagueSettings/LeagueSettings";
import { LeagueError, LeagueLoading, NoLeague, StaleLeague } from "../../components/LeagueState/LeagueState";
import { LeagueTeams } from "../../components/LeagueTeams/LeagueTeams";
import { TeamClaimPanel } from "../../components/TeamClaimPanel/TeamClaimPanel";
import { useLeaguePageData } from "../../hooks/useLeaguePageData";
import { leaguePath } from "../../lib/leaguePaths";
import "./LeaguePage.css";

interface LeaguePageContentProps {
  readonly data: ReturnType<typeof useLeaguePageData>;
}

function LeaguePageContent({ data }: LeaguePageContentProps) {
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
  const commissionerPath = leaguePath(league, "commissioner");
  const keepersEnabled = season.settings.keeperPolicy.enabled !== false;

  return (
    <div className="league-page">
      <LeagueHeader league={league} />
      {needsClaim ? (
        <TeamClaimPanel
          canManageLeague={league.canManageLeague}
          keepersPath={`${commissionerPath}#league-setup`}
          seasonId={league.seasonId}
          teams={data.season.data.claimableTeams}
        />
      ) : null}
      <LeagueSettings season={season} />
      <DraftStatus league={league} />
      <LeagueTeams
        keepers={data.keepers.data.keepers}
        keepersEnabled={keepersEnabled}
        manageKeepersPath={league.canManageLeague && keepersEnabled ? `${commissionerPath}#league-setup` : undefined}
        teams={season.teams}
      />
    </div>
  );
}

export function LeaguePage() {
  const navigate = useNavigate();
  const { leagueSlug } = useParams<{ leagueSlug: string }>();
  const [search, setSearch] = useSearchParams();
  const data = useLeaguePageData(search.get("seasonId"), leagueSlug);
  const updateSearch = (seasonId?: string) => {
    const nextSearch = new URLSearchParams(search);
    nextSearch.delete("create");
    if (seasonId === undefined) {
      setSearch(nextSearch, { replace: true });
      return;
    }
    const league = data.onboarding.data?.leagues.find(candidate => candidate.seasonId === seasonId);
    if (league === undefined) {
      nextSearch.set("seasonId", seasonId);
      setSearch(nextSearch, { replace: true });
      return;
    }
    nextSearch.delete("seasonId");
    void navigate({ pathname: leaguePath(league, "league"), search: nextSearch.toString() }, { replace: true });
  };

  return (
    <>
      <LeaguePageContent data={data} />
      <CreateLeagueWizard
        onClose={() => { updateSearch(); }}
        onCreated={updateSearch}
        open={search.get("create") === "1"}
      />
    </>
  );
}
