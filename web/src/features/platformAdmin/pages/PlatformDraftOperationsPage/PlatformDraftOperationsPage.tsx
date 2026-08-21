import { useQuery } from "@tanstack/react-query";
import { platformDraftOperationsOptions } from "../../api/platformDraftOperationsApi";
import { DraftOperationsSummary } from "../../components/DraftOperationsSummary/DraftOperationsSummary";
import { DraftOperationsTable } from "../../components/DraftOperationsTable/DraftOperationsTable";
import "./PlatformDraftOperationsPage.css";

export const PlatformDraftOperationsPage = () => {
  const query = useQuery(platformDraftOperationsOptions());
  if (query.isPending) return <p role="status">Loading draft operations...</p>;
  if (query.isError) {
    return <p role="alert">Draft operations are unavailable. Refresh and try again.</p>;
  }
  const schedule = query.data;
  return (
    <section aria-labelledby="draft-operations-title" className="platform-draft-operations-page">
      <header>
        <p>Platform administration</p>
        <h1 id="draft-operations-title">Draft operations</h1>
        <span>Monitor scheduled rooms, readiness, and expected draft concurrency.</span>
      </header>
      <DraftOperationsSummary schedule={schedule} />
      <section aria-labelledby="today-drafts-title">
        <h2 id="today-drafts-title">Today</h2>
        <DraftOperationsTable
          drafts={schedule.today}
          emptyMessage="No drafts are scheduled today."
          timezone={schedule.timezone}
        />
      </section>
      <section aria-labelledby="upcoming-drafts-title">
        <h2 id="upcoming-drafts-title">Upcoming</h2>
        <DraftOperationsTable
          drafts={schedule.upcoming}
          emptyMessage="No drafts are scheduled in the next 30 days."
          timezone={schedule.timezone}
        />
      </section>
    </section>
  );
};
