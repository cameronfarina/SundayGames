import { Link } from "react-router-dom";

export function LeagueLoading() {
  return <p aria-live="polite">Loading your league...</p>;
}

export function NoLeague() {
  return (
    <section className="league-state" aria-labelledby="no-league-title">
      <p className="league-eyebrow">League</p>
      <h1 id="no-league-title">Your leagues</h1>
      <p>Create a league, or open the private invitation link your commissioner shared.</p>
      <Link className="league-button league-button--primary" to="/league?create=1">
        Create a league
      </Link>
    </section>
  );
}

export function StaleLeague() {
  return (
    <section className="league-state" aria-labelledby="stale-league-title">
      <h1 id="stale-league-title">League unavailable</h1>
      <p>This league is not connected to your account.</p>
      <Link className="league-button" to="/league">Open active league</Link>
    </section>
  );
}

interface LeagueErrorProps {
  readonly error: Error;
  readonly retry?: () => void;
}

export function LeagueError({ error, retry }: LeagueErrorProps) {
  return (
    <section className="league-state" aria-label="League error">
      <p role="alert">{error.message}</p>
      {retry === undefined ? null : (
        <button className="league-button" type="button" onClick={retry}>Try again</button>
      )}
    </section>
  );
}
