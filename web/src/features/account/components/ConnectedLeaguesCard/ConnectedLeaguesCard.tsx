import { Link } from "react-router-dom";
import { useLeagueConnectionsQuery } from "../../../leagueConnections/hooks/useLeagueConnectionQueries";
import { connectionCounts } from "../../model/connectionCounts";
import "./ConnectedLeaguesCard.css";

const leagueCount = (count: number): string =>
  `${String(count)} ${count === 1 ? "league" : "leagues"}`;

export const ConnectedLeaguesCard = () => {
  // Shares the connections page's cache entry rather than fetching a second time.
  const connections = useLeagueConnectionsQuery();
  const counts = connections.data === undefined
    ? undefined
    : connectionCounts(connections.data.connections);

  return (
    <section aria-labelledby="connections-heading" className="account-card connections-card">
      <h2 className="account-card__heading" id="connections-heading">Connected leagues</h2>
      {counts === undefined
        ? (
          // The counts are a convenience, so a slow or failed read leaves the
          // way through to the page that can actually fix it.
          <p className="connections-card__note" role="status">
            {connections.isPending ? "Counting your leagues..." : "We could not read your league connections."}
          </p>
        )
        : (
          <dl className="connections-card__counts">
            <div>
              <dt>Connected</dt>
              <dd>{leagueCount(counts.total)}</dd>
            </div>
            <div>
              <dt>Synced</dt>
              <dd>{leagueCount(counts.synced)}</dd>
            </div>
            <div className={counts.needsAttention > 0 ? "connections-card__attention" : undefined}>
              <dt>Need attention</dt>
              <dd>{leagueCount(counts.needsAttention)}</dd>
            </div>
          </dl>
        )}
      {counts !== undefined && counts.needsAttention > 0 && (
        // Deliberately vague about the remedy: this bucket holds expired
        // credentials, leagues that no longer exist, and providers that are not
        // ready yet, and only the connections page knows which is which.
        <p className="connections-card__note">
          Open your connections to see what each one is waiting on.
        </p>
      )}
      <Link className="connections-card__link" to="/connections">Manage connections</Link>
    </section>
  );
};
