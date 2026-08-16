import { useSearchParams } from "react-router-dom";
import { useOnboardingQuery } from "../../../../shared/api/onboarding/onboardingQuery";
import { PlayerNews } from "../../components/PlayerNews/PlayerNews";
import "./PlayerNewsPage.css";

export const PlayerNewsPage = () => {
  const onboarding = useOnboardingQuery();
  const [searchParams] = useSearchParams();
  const requestedSeasonId = searchParams.get("seasonId");
  const leagues = onboarding.data?.leagues ?? [];
  const league = leagues.find(candidate => candidate.seasonId === requestedSeasonId) ?? leagues.at(0);
  const accountId = onboarding.data?.account.id;

  return (
    <section aria-labelledby="player-news-title" className="player-news-page">
      <header className="player-news-page__header">
        <p>News desk</p>
        <h1 id="player-news-title">Player news</h1>
        <span>Search current player updates and follow the players you care about.</span>
      </header>
      {accountId === undefined
        ? <p role="status">Loading player news...</p>
        : <PlayerNews accountId={accountId} key={accountId} seasonId={league?.seasonId} />}
    </section>
  );
};
