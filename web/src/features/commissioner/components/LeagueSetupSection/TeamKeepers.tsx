import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { invalidateKeeperConsumers } from "../../../../shared/api/queries/seasonQueryInvalidation";
import { commissionerApi } from "../../api/commissionerApi";
import type { CommissionerKeeper } from "../../api/workspaceSchemas";
import { errorMessage } from "../../model/errorMessage";

interface TeamKeepersProps {
  readonly keepers: readonly CommissionerKeeper[];
  /** The saved manager name. The command resolves a team by name, so an edit
   * that has not been applied yet would not match anything. */
  readonly savedOwnerDisplayName: string;
  readonly seasonId: string;
  readonly teamId: string;
}

const keeperLabel = (keeper: CommissionerKeeper): string => keeper.keeperRound === undefined
  ? `${keeper.playerName} $${String(keeper.price)}`
  : `${keeper.playerName} R${String(keeper.keeperRound)}`;

export function TeamKeepers({
  keepers,
  savedOwnerDisplayName,
  seasonId,
  teamId,
}: TeamKeepersProps) {
  const [entry, setEntry] = useState<string | null>(null);
  const isAdding = entry !== null;
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Focus follows the click that opened the field, so the commissioner can
  // type straight away instead of clicking twice.
  useEffect(() => { if (isAdding) inputRef.current?.focus(); }, [isAdding]);
  const queryClient = useQueryClient();
  const refresh = async () => { await invalidateKeeperConsumers(queryClient, seasonId); };
  const add = useMutation({
    mutationFn: (typed: string) =>
      commissionerApi.addKeeper(seasonId, `${savedOwnerDisplayName} keeping ${typed}`),
    onSuccess: async () => { setEntry(null); await refresh(); },
  });
  const remove = useMutation({
    mutationFn: (playerId: string) => commissionerApi.removeKeeper(seasonId, teamId, playerId),
    onSuccess: refresh,
  });
  const busy = add.isPending || remove.isPending;

  return (
    <div className="team-keepers">
      {keepers.map(keeper => {
        const playerId = keeper.playerId;
        return (
          <span className="team-keepers__chip" key={`${keeper.teamId}-${keeper.playerName}`}>
            {keeperLabel(keeper)}
            {playerId !== undefined && (
              <button
                aria-label={`Remove ${keeper.playerName} from ${savedOwnerDisplayName}`}
                disabled={busy}
                onClick={() => { remove.mutate(playerId); }}
                type="button"
              >×</button>
            )}
          </span>
        );
      })}
      {entry === null
        ? <button
            className="team-keepers__add"
            disabled={busy}
            onClick={() => { setEntry(""); add.reset(); }}
            type="button"
          >+ Keeper</button>
        : <span className="team-keepers__entry">
            <input
              aria-label={`Keeper for ${savedOwnerDisplayName}`}
              onChange={event => { setEntry(event.target.value); }}
              onKeyDown={event => {
                if (event.key === "Enter" && entry.trim().length > 0) add.mutate(entry.trim());
                if (event.key === "Escape") setEntry(null);
              }}
              placeholder="Chase 40"
              ref={inputRef}
              value={entry}
            />
            <button
              disabled={entry.trim().length === 0 || busy}
              onClick={() => { add.mutate(entry.trim()); }}
              type="button"
            >{add.isPending ? "Saving..." : "Save"}</button>
            <button disabled={busy} onClick={() => { setEntry(null); }} type="button">Cancel</button>
          </span>}
      {add.isError && <p className="team-keepers__error" role="alert">{errorMessage(add.error)}</p>}
      {remove.isError && <p className="team-keepers__error" role="alert">{errorMessage(remove.error)}</p>}
    </div>
  );
}
