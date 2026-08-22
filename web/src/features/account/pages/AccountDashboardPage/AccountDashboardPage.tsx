import { Link } from "react-router-dom";
import { AccountUpcomingDrafts } from "../../components/AccountUpcomingDrafts/AccountUpcomingDrafts";
import { LeagueDashboardCard } from "../../components/LeagueDashboardCard/LeagueDashboardCard";
import { useAccountDashboardQuery } from "../../api/accountDashboardQuery";
import "./AccountDashboardPage.css";

export const AccountDashboardPage = () => {
  const dashboard = useAccountDashboardQuery();

  if (dashboard.isPending) {
    return <section aria-label="Account dashboard" className="account-dashboard"><p role="status">Loading your leagues...</p></section>;
  }
  if (dashboard.isError) {
    return (
      <section aria-label="Account dashboard" className="account-dashboard">
        <h1>Account dashboard</h1>
        <p role="alert">Could not load your account dashboard. Refresh the page to try again.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="account-dashboard-title" className="account-dashboard">
      <header className="account-dashboard__header">
        <div><p>Your account</p><h1 id="account-dashboard-title">League dashboard</h1></div>
        <Link to="/account-settings">Account settings</Link>
        <span>Every active league, draft, and retained practice activity connected to this account.</span>
      </header>
      {dashboard.data.leagues.length === 0 ? (
        <section className="account-dashboard__empty">
          <h2>No leagues yet</h2>
          <p>Connect a fantasy account or create a league to start tracking it here.</p>
          <Link to="/connections">Connect a league</Link>
        </section>
      ) : <>
        <AccountUpcomingDrafts leagues={dashboard.data.leagues} />
        <div className="account-dashboard__league-heading">
          <p>League status</p><h2>Your leagues</h2>
          <span>Practice activity reflects retained data: completed mocks from the last 24 hours and your latest 25 simulation batches.</span>
        </div>
        <div className="account-dashboard__leagues">
          {dashboard.data.leagues.map(league => <LeagueDashboardCard key={league.seasonId} league={league} />)}
        </div>
      </>}
    </section>
  );
};
