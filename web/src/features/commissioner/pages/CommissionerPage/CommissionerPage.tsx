import { Fragment } from "react";
import { useSearchParams } from "react-router-dom";
import { HistoricalImportSection } from "../../components/HistoricalImportSection/HistoricalImportSection";
import { InvitationSection } from "../../components/InvitationSection/InvitationSection";
import { KeeperSection } from "../../components/KeeperSection/KeeperSection";
import { LeagueSetupSection } from "../../components/LeagueSetupSection/LeagueSetupSection";
import { LiveRoomSection } from "../../components/LiveRoomSection/LiveRoomSection";
import "./CommissionerPage.css";
import { useCommissionerWorkspace } from "./hooks/useCommissionerWorkspace";

export function CommissionerPage() {
  const [searchParams] = useSearchParams();
  const workspace = useCommissionerWorkspace(searchParams.get("seasonId"));

  if (workspace.onboarding.isPending) {
    return <section aria-label="Commissioner" className="commissioner-page"><p role="status">Loading commissioner tools...</p></section>;
  }
  if (workspace.onboarding.isError) {
    return <section aria-label="Commissioner" className="commissioner-page"><h1>Commissioner</h1><p role="alert">Could not load your leagues.</p></section>;
  }
  if (workspace.selectedLeague?.canManageLeague !== true) {
    return (
      <section aria-label="Commissioner" className="commissioner-page">
        <h1>Commissioner access required</h1>
        <p>Only league owners and admins can change shared league setup.</p>
      </section>
    );
  }
  if (workspace.season.isPending || workspace.keepers.isPending || workspace.invitations.isPending) {
    return <section aria-label="Commissioner" className="commissioner-page"><p role="status">Loading league setup...</p></section>;
  }
  if (workspace.season.isError || workspace.keepers.isError || workspace.invitations.isError) {
    return <section aria-label="Commissioner" className="commissioner-page"><h1>Commissioner</h1><p role="alert">Could not load league setup.</p></section>;
  }

  const season = workspace.season.data.season;
  return (
    <section aria-label="Commissioner" className="commissioner-page">
      <header className="commissioner-heading">
        <div><span className="commissioner-eyebrow">League operations</span><h1>Commissioner</h1></div>
        <strong>{workspace.selectedLeague.leagueName} · {workspace.selectedLeague.seasonYear}</strong>
      </header>
      <nav aria-label="Commissioner sections" className="commissioner-section-nav">
        <a href="#league-setup">League info</a><a href="#keepers">Keepers</a>
        <a href="#draft-history">Draft history</a><a href="#league-invite">Invite</a>
        <a href="#live-room">Live room</a>
      </nav>
      <Fragment key={season.id}>
        <LeagueSetupSection season={season} />
        <KeeperSection keepers={workspace.keepers.data.keepers} season={season} />
        <HistoricalImportSection season={season} />
        <InvitationSection invitations={workspace.invitations.data.invitations} seasonId={season.id} />
        <LiveRoomSection league={workspace.selectedLeague} season={season} />
      </Fragment>
    </section>
  );
}
