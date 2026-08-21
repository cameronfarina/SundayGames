import { Fragment } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { HistoricalImportSection } from "../../components/HistoricalImportSection/HistoricalImportSection";
import { InvitationSection } from "../../components/InvitationSection/InvitationSection";
import { LeagueSetupSection } from "../../components/LeagueSetupSection/LeagueSetupSection";
import { LiveRoomSection } from "../../components/LiveRoomSection/LiveRoomSection";
import "./CommissionerPage.css";
import { useCommissionerWorkspace } from "./hooks/useCommissionerWorkspace";

type CommissionerSection = "overview" | "live-draft" | "history";

const sectionFor = (value: string | null): CommissionerSection => {
  if (value === "live-draft" || value === "history") return value;
  return "overview";
};

const sectionLabels: readonly { readonly label: string; readonly value: CommissionerSection }[] = [
  { label: "Overview", value: "overview" },
  { label: "Live Draft", value: "live-draft" },
  { label: "History", value: "history" },
];

export function CommissionerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { leagueSlug } = useParams<{ leagueSlug: string }>();
  const requestedSection = searchParams.get("section");
  const activeSection = requestedSection === null && location.hash === "#live-room"
    ? "live-draft"
    : sectionFor(requestedSection);
  const workspace = useCommissionerWorkspace(
    searchParams.get("seasonId"),
    leagueSlug,
    activeSection === "overview",
  );

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
  const overviewPending = activeSection === "overview"
    && (workspace.keepers.isPending || workspace.invitations.isPending);
  if (workspace.season.isPending || overviewPending) {
    return <section aria-label="Commissioner" className="commissioner-page"><p role="status">Loading league setup...</p></section>;
  }
  const overviewError = activeSection === "overview"
    && (workspace.keepers.isError || workspace.invitations.isError);
  if (workspace.season.isError || overviewError) {
    return <section aria-label="Commissioner" className="commissioner-page"><h1>Commissioner</h1><p role="alert">Could not load league setup.</p></section>;
  }

  const season = workspace.season.data.season;
  const overviewData = workspace.keepers.data !== undefined && workspace.invitations.data !== undefined
    ? { invitations: workspace.invitations.data.invitations, keepers: workspace.keepers.data.keepers }
    : null;
  const selectSection = (section: CommissionerSection) => {
    const next = new URLSearchParams(searchParams);
    if (section === "overview") next.delete("section");
    else next.set("section", section);
    if (location.hash === "#live-room") {
      const nextSearch = next.toString();
      void navigate({
        hash: "",
        pathname: location.pathname,
        search: nextSearch === "" ? "" : `?${nextSearch}`,
      });
      return;
    }
    setSearchParams(next);
  };

  return (
    <section aria-label="Commissioner" className="commissioner-page">
      <header className="commissioner-heading">
        <div><span className="commissioner-eyebrow">League operations</span><h1>Commissioner</h1></div>
        <strong>{workspace.selectedLeague.leagueName} · {workspace.selectedLeague.seasonYear}</strong>
      </header>
      <nav aria-label="Commissioner sections" className="commissioner-section-nav">
        {sectionLabels.map(section => (
          <button
            aria-current={activeSection === section.value ? "page" : undefined}
            key={section.value}
            onClick={() => { selectSection(section.value); }}
            type="button"
          >
            {section.label}
          </button>
        ))}
      </nav>
      <Fragment key={`${season.id}-${activeSection}`}>
        {activeSection === "overview" && overviewData !== null ? (
          <LeagueSetupSection
            keepers={overviewData.keepers}
            season={season}
            summaryAction={(
              <InvitationSection
                invitations={overviewData.invitations}
                season={season}
              />
            )}
          />
        ) : null}
        {activeSection === "live-draft" ? (
          <LiveRoomSection
            league={workspace.selectedLeague}
            manageableLeagues={workspace.manageableLeagues}
            season={season}
          />
        ) : null}
        {activeSection === "history" ? <HistoricalImportSection season={season} /> : null}
      </Fragment>
    </section>
  );
}
