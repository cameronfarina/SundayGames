import { EmptyTeamState } from "../../components/EmptyTeamState/EmptyTeamState";
import { PostDraftTeamView } from "../../components/PostDraftTeam/PostDraftTeam";
import { PreDraftTeam } from "../../components/PreDraftTeam/PreDraftTeam";
import { useMyTeamPageState } from "../../hooks/useMyTeamPageState";
import "./MyTeamPage.css";

export const MyTeamPage = () => {
  const state = useMyTeamPageState();
  const league = state.kind === "pre-draft" || state.kind === "post-draft" ? state.league : undefined;

  return (
    <main className="my-team-page" id="main-content">
      <header className="my-team-header">
        <p className="my-team-eyebrow">My team</p>
        <h1>{league?.membership.teamDisplayName ?? "My team"}</h1>
        <p>Keepers and draft-day budget before the draft. Private roster analysis after it ends.</p>
      </header>
      {state.kind === "loading" && <p className="my-team-status" role="status">Loading your team...</p>}
      {state.kind === "error" && <p className="my-team-error" role="alert">{state.error.message}</p>}
      {state.kind === "no-league" && <EmptyTeamState />}
      {state.kind === "unassigned" && <EmptyTeamState league={state.league} />}
      {state.kind === "pre-draft" && (
        <PreDraftTeam
          keepers={state.keepers}
          league={state.league}
          season={state.season}
          teamId={state.teamId}
        />
      )}
      {state.kind === "post-draft" && <PostDraftTeamView team={state.team} />}
    </main>
  );
};
