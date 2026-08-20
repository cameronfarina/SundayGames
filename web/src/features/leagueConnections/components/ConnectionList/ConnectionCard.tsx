import type { LeagueConnection } from "../../api/leagueConnectionsSchema";
import { formatSyncedAt, statusMessage, statusPresentation } from "../../lib/connectionStatus";
import { ConnectionCardActions } from "./ConnectionCardActions";
import { StatusDot } from "./StatusDot";

interface ConnectionCardProps {
  readonly connection: LeagueConnection;
  readonly onImport: (connectionId: string) => void;
  readonly onRemove: (connectionId: string) => void;
  readonly onSelect: (connectionId: string) => void;
  readonly onSync: (connectionId: string) => void;
  readonly pending: boolean;
  readonly selected: boolean;
}

export const ConnectionCard = ({
  connection,
  onImport,
  onRemove,
  onSelect,
  onSync,
  pending,
  selected,
}: ConnectionCardProps) => {
  const presentation = statusPresentation(connection.status);

  return <article
    className={`connection-card${selected ? " connection-card--selected" : ""}`}
  >
    <header>
      <StatusDot status={connection.status} />
      <div>
        <p className="connection-card__provider">{connection.provider}</p>
        <h3>{connection.displayName}</h3>
      </div>
      <span className="connection-card__status">{presentation.label}</span>
    </header>
    <p className="connection-card__detail">
      {statusMessage(connection.status, connection.statusDetail)}
    </p>
    <p className="connection-card__synced">
      {connection.season} season · {formatSyncedAt(connection.lastSyncedAt)}
    </p>
    {connection.importedLeagueName === undefined
      ? null
      : <p className="connection-card__imported">
        Imported as {connection.importedLeagueName}
      </p>}
    <ConnectionCardActions
      connection={connection}
      onImport={onImport}
      onRemove={onRemove}
      onSelect={onSelect}
      onSync={onSync}
      pending={pending}
      selected={selected}
    />
  </article>;
};
