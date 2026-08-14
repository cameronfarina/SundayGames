import type { OnboardingLeague } from "../../api/leagueSchemas";

const draftDate = (value: string | undefined): string => value === undefined
  ? "No draft time scheduled"
  : new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" }).format(new Date(value));

const roomStatus = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

export function DraftStatus({ league }: { readonly league: OnboardingLeague }) {
  return (
    <section className="league-section" aria-labelledby="draft-status-title">
      <h2 id="draft-status-title">Draft status</h2>
      <dl className="league-facts league-facts--compact">
        <div><dt>Schedule</dt><dd>{draftDate(league.nextDraftAt)}</dd></div>
        <div>
          <dt>Room</dt>
          <dd>{league.liveDraft === null ? "Draft room not ready" : roomStatus(league.liveDraft.status)}</dd>
        </div>
      </dl>
    </section>
  );
}
