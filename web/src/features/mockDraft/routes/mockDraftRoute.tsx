import { Link, useSearchParams } from "react-router-dom";
import { InlineNotice } from "../../../shared/ui";
import { MockDraftPage } from "../pages/MockDraftPage/MockDraftPage";

export function MockDraftRoutePage() {
  const [params, setParams] = useSearchParams();
  const seasonId = params.get("seasonId");
  const sessionId = params.get("sessionId") ?? undefined;

  if (seasonId === null) {
    return (
      <section aria-labelledby="mock-league-required">
        <h1 id="mock-league-required">Choose a league first</h1>
        <InlineNotice variant="warning">
          Auction mocks use the active league's teams, keepers, budget, and roster settings.
        </InlineNotice>
        <Link to="/league">Open League</Link>
      </section>
    );
  }

  const setSessionId = (nextSessionId: string | undefined) => {
    const next = new URLSearchParams(params);
    if (nextSessionId === undefined) next.delete("sessionId");
    else next.set("sessionId", nextSessionId);
    setParams(next, { replace: true });
  };

  return (
    <MockDraftPage
      {...(sessionId === undefined ? {} : { initialSessionId: sessionId })}
      key={seasonId}
      onSessionChange={setSessionId}
      seasonId={seasonId}
    />
  );
}

export const Component = MockDraftRoutePage;
