import { EmptyState } from "../../../../shared/ui";
import type { LeagueConnection } from "../../api/leagueConnectionsSchema";
import { ConnectionCard } from "./ConnectionCard";
import { StatusLegend } from "./StatusLegend";
import "./ConnectionList.css";

interface ConnectionListProps {
  readonly connections: readonly LeagueConnection[];
  readonly onImport: (connectionId: string) => void;
  readonly onRemove: (connectionId: string) => void;
  readonly onSelect: (connectionId: string) => void;
  readonly onSync: (connectionId: string) => void;
  readonly pendingConnectionId: string | undefined;
  readonly selectedConnectionId: string | undefined;
}

export const ConnectionList = ({
  connections,
  onImport,
  onRemove,
  onSelect,
  onSync,
  pendingConnectionId,
  selectedConnectionId,
}: ConnectionListProps) => {
  if (connections.length === 0) {
    return <EmptyState
      description="Connect Sleeper or ESPN below and Sunday Games will pull in your rosters, matchups, and settings."
      title="No leagues connected yet"
    />;
  }

  return <div className="connection-list-panel">
    <StatusLegend />
    <div aria-label="Connected leagues" className="connection-list" role="list">
      {connections.map(connection => <div key={connection.id} role="listitem">
        <ConnectionCard
          connection={connection}
          onImport={onImport}
          onRemove={onRemove}
          onSelect={onSelect}
          onSync={onSync}
          pending={pendingConnectionId === connection.id}
          selected={selectedConnectionId === connection.id}
        />
      </div>)}
    </div>
  </div>;
};
