import { Navigate, useSearchParams } from "react-router-dom";
import { DraftPrep } from "../../components/DraftPrep/DraftPrep";
import { EmptyTeamState } from "../../components/EmptyTeamState/EmptyTeamState";
import { MyTeamTabs, type MyTeamView } from "../../components/MyTeamTabs/MyTeamTabs";
import { PostDraftTeamView } from "../../components/PostDraftTeam/PostDraftTeam";
import { PreDraftTeam } from "../../components/PreDraftTeam/PreDraftTeam";
import { useMyTeamPageState } from "../../hooks/useMyTeamPageState";
import "./MyTeamPage.css";

const viewFrom = (value: string | null): MyTeamView =>
  value === "prep" ? value : "team";

export const MyTeamPage = () => {
  const [params] = useSearchParams();
  const state = useMyTeamPageState();
  if (params.get("view") === "news") {
    const search = new URLSearchParams(params);
    search.delete("view");
    return <Navigate replace to={{ pathname: "/player-news", search: search.toString() }} />;
  }
  const view = viewFrom(params.get("view"));
  const league = state.kind === "pre-draft" || state.kind === "post-draft" ? state.league : undefined;
  const unassignedLeague = state.kind === "unassigned" ? state.league : undefined;
  const activeLeague = league ?? unassignedLeague;
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
      {activeLeague === undefined ? null : <MyTeamTabs seasonId={activeLeague.seasonId} view={view} />}
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
    </section>
  );
};
