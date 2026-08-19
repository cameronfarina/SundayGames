import { Button } from "../../../../shared/ui";
import type { LeagueConnection } from "../../api/leagueConnectionsSchema";
import { formatSyncedAt, statusMessage, statusPresentation } from "../../lib/connectionStatus";
import { StatusDot } from "./StatusDot";

interface ConnectionCardProps {
  readonly connection: LeagueConnection;
  readonly onRemove: (connectionId: string) => void;
  readonly onSelect: (connectionId: string) => void;
  readonly onSync: (connectionId: string) => void;
  readonly pending: boolean;
  readonly selected: boolean;
}

export const ConnectionCard = ({
  connection,
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
    <div className="connection-card__actions">
      <Button
        aria-label={`View ${connection.displayName}`}
        aria-pressed={selected}
        onClick={() => { onSelect(connection.id); }}
        variant="secondary"
      >View league</Button>
      <Button
        aria-label={`Sync ${connection.displayName} now`}
        disabled={pending}
        onClick={() => { onSync(connection.id); }}
        variant="secondary"
      >Sync now</Button>
      <Button
        aria-label={`Disconnect ${connection.displayName}`}
        disabled={pending}
        onClick={() => { onRemove(connection.id); }}
        variant="danger"
      >Disconnect</Button>
    </div>
  </article>;
};
