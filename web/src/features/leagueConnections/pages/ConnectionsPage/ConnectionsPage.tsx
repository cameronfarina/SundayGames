import { useSearchParams } from "react-router-dom";
import { InlineNotice } from "../../../../shared/ui";
import { AddConnection } from "../../components/AddConnection/AddConnection";
import { ConnectionList } from "../../components/ConnectionList/ConnectionList";
import { LeagueDetail } from "../../components/LeagueDetail/LeagueDetail";
import { useLeagueConnectionMutations } from "../../hooks/useLeagueConnectionMutations";
import { useLeagueConnectionsQuery } from "../../hooks/useLeagueConnectionQueries";
import { pendingConnectionId } from "../../lib/pendingConnection";
import "./ConnectionsPage.css";

const selectedConnectionParam = "connection";

export const ConnectionsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const connections = useLeagueConnectionsQuery();
  const mutations = useLeagueConnectionMutations();
  const selectedConnectionId = searchParams.get(selectedConnectionParam) ?? undefined;

  const select = (connectionId: string): void => {
    const next = new URLSearchParams(searchParams);
    if (connectionId === selectedConnectionId) next.delete(selectedConnectionParam);
    else next.set(selectedConnectionParam, connectionId);
    setSearchParams(next);
  };
  const remove = (connectionId: string): void => {
    mutations.remove.mutate(connectionId, {
      onSuccess: () => {
        if (connectionId !== selectedConnectionId) return;
        const next = new URLSearchParams(searchParams);
        next.delete(selectedConnectionParam);
        setSearchParams(next);
      },
    });
  };

  return <section aria-labelledby="connections-title" className="connections-page">
    <header className="connections-page__header">
      <p>League sync</p>
      <h1 id="connections-title">Connections</h1>
      <span>
        Bring your Sleeper and ESPN leagues into Sunday Games. Sunday Games only reads them:
        it never sets a lineup or makes a move for you.
      </span>
    </header>
    {connections.isPending ? <p role="status">Loading connected leagues...</p> : null}
    {connections.isError
      ? <InlineNotice variant="error">{connections.error.message}</InlineNotice>
      : null}
    {connections.data === undefined ? null : <ConnectionList
      connections={connections.data.connections}
      onRemove={remove}
      onSelect={select}
      onSync={connectionId => { mutations.sync.mutate(connectionId); }}
      pendingConnectionId={pendingConnectionId(mutations.sync, mutations.remove)}
      selectedConnectionId={selectedConnectionId}
    />}
    {selectedConnectionId === undefined
      ? null
      : <LeagueDetail connectionId={selectedConnectionId} key={selectedConnectionId} />}
    {connections.data === undefined
      ? null
      : <AddConnection
        connections={connections.data.connections}
        mutations={mutations}
        providers={connections.data.providers}
      />}
  </section>;
};
