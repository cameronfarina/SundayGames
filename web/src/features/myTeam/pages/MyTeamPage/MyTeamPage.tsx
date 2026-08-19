import { Navigate, useSearchParams } from "react-router-dom";
import { DraftPrep } from "../../components/DraftPrep/DraftPrep";
import { EmptyTeamState } from "../../components/EmptyTeamState/EmptyTeamState";
import { InSeasonLocked } from "../../components/InSeasonTools/InSeasonLocked";
import { InSeasonTools, type InSeasonView } from "../../components/InSeasonTools/InSeasonTools";
import { MyTeamTabs, type MyTeamView } from "../../components/MyTeamTabs/MyTeamTabs";
import { PostDraftTeamView } from "../../components/PostDraftTeam/PostDraftTeam";
import { PreDraftTeam } from "../../components/PreDraftTeam/PreDraftTeam";
import { useMyTeamPageState } from "../../hooks/useMyTeamPageState";
import { leaguePath } from "../../../league/lib/leaguePaths";
import "./MyTeamPage.css";

const viewFrom = (value: string | null): MyTeamView =>
  value === "prep" || value === "lineup" || value === "waivers" ? value : "team";

const inSeasonViewFrom = (view: MyTeamView): InSeasonView | undefined =>
  view === "lineup" || view === "waivers" ? view : undefined;

export const MyTeamPage = () => {
  const [params] = useSearchParams();
  const state = useMyTeamPageState();
  const league = state.kind === "pre-draft" || state.kind === "post-draft" ? state.league : undefined;
  const unassignedLeague = state.kind === "unassigned" ? state.league : undefined;
  const activeLeague = league ?? unassignedLeague;
  if (params.get("view") === "news") {
    if (state.kind === "loading") return <p className="my-team-status" role="status">Loading your team...</p>;
    const search = new URLSearchParams(params);
    search.delete("view");
    search.delete("seasonId");
    return <Navigate replace to={{
      pathname: activeLeague === undefined ? "/player-news" : leaguePath(activeLeague, "player-news"),
      search: search.toString(),
    }} />;
  }
  const view = viewFrom(params.get("view"));
  const inSeasonView = inSeasonViewFrom(view);
  return (
    <section aria-labelledby="my-team-title" className="my-team-page">
      <header className="my-team-header">
        <p className="my-team-eyebrow">My team</p>
        <h1 id="my-team-title">{league?.membership.teamDisplayName ?? "My team"}</h1>
        <p>Your roster, reusable draft plan, and saved simulation outcomes.</p>
      </header>
      {state.kind === "loading" && <p className="my-team-status" role="status">Loading your team...</p>}
      {state.kind === "error" && <p className="my-team-error" role="alert">{state.error.message}</p>}
      {state.kind === "no-league" && <EmptyTeamState />}
      {activeLeague === undefined ? null : <MyTeamTabs league={activeLeague} view={view} />}
      {view === "team" && state.kind === "unassigned" && <EmptyTeamState league={state.league} />}
      {view === "team" && state.kind === "pre-draft" && (
        <PreDraftTeam
          keepers={state.keepers}
          league={state.league}
          season={state.season}
          teamId={state.teamId}
        />
      )}
      {view === "team" && state.kind === "post-draft" && <PostDraftTeamView team={state.team} />}
      {view === "prep" && activeLeague !== undefined && <DraftPrep seasonId={activeLeague.seasonId} />}
      {inSeasonView !== undefined && (state.kind === "pre-draft" || state.kind === "unassigned") && (
        <InSeasonLocked view={inSeasonView} />
      )}
      {inSeasonView !== undefined && state.kind === "post-draft" && (
        <InSeasonTools roomId={state.roomId} view={inSeasonView} />
      )}
    </section>
  );
};
