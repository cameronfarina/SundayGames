import { Button } from "../../../../shared/ui";
import type { LeagueConnection } from "../../api/leagueConnectionsSchema";

interface ConnectionCardActionsProps {
  readonly connection: LeagueConnection;
  readonly onImport: (connectionId: string) => void;
  readonly onRemove: (connectionId: string) => void;
  readonly onSelect: (connectionId: string) => void;
  readonly onSync: (connectionId: string) => void;
  readonly pending: boolean;
  readonly selected: boolean;
}

export const ConnectionCardActions = ({
  connection,
  onImport,
  onRemove,
  onSelect,
  onSync,
  pending,
  selected,
}: ConnectionCardActionsProps) => <div className="connection-card__actions">
  <Button
    aria-label={`View ${connection.displayName}`}
    aria-pressed={selected}
    onClick={() => { onSelect(connection.id); }}
    variant="secondary"
  >View league</Button>
  {connection.importedLeagueSlug !== undefined ? null : <Button
    aria-label={`Import ${connection.displayName}`}
    disabled={pending}
    onClick={() => { onImport(connection.id); }}
  >Import</Button>}
  {/* A synced connection is already current, so the only people who need this
      button are the ones whose league did not come through. */}
  {connection.status === "ok" ? null : <Button
    aria-label={`Sync ${connection.displayName} now`}
    disabled={pending}
    onClick={() => { onSync(connection.id); }}
    variant="secondary"
  >Sync now</Button>}
  <Button
    aria-label={`Disconnect ${connection.displayName}`}
    disabled={pending}
    onClick={() => { onRemove(connection.id); }}
    variant="danger"
  >Disconnect</Button>
</div>;
