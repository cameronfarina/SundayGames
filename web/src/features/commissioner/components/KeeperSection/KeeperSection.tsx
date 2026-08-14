import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type SyntheticEvent } from "react";
import { Button, TextField } from "../../../../shared/ui/index.js";
import { invalidateKeeperConsumers } from "../../../../shared/api/queries/seasonQueryInvalidation";
import { commissionerApi } from "../../api/commissionerApi";
import type { CommissionerSeason } from "../../api/seasonSchemas";
import type { CommissionerKeeper } from "../../api/workspaceSchemas";
import { errorMessage } from "../../model/errorMessage";

interface KeeperSectionProps {
  readonly keepers: readonly CommissionerKeeper[];
  readonly season: CommissionerSeason;
}

interface KeeperIdentity { readonly playerId: string; readonly teamId: string }

export function KeeperSection({ keepers, season }: KeeperSectionProps) {
  const [command, setCommand] = useState("");
  const queryClient = useQueryClient();
  const refresh = async () => { await invalidateKeeperConsumers(queryClient, season.id); };
  const add = useMutation({
    mutationFn: () => commissionerApi.addKeeper(season.id, command.trim()),
    onSuccess: async () => { setCommand(""); await refresh(); },
  });
  const remove = useMutation({
    mutationFn: (keeper: KeeperIdentity) => commissionerApi.removeKeeper(season.id, keeper.teamId, keeper.playerId),
    onSuccess: refresh,
  });
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (command.trim().length > 0) add.mutate();
  };
  const teamNames = new Map(season.teams.map(team => [team.id, team.displayName]));

  return (
    <section className="commissioner-section" id="keepers">
      <header><div><span>02</span><h2>Keepers</h2></div><strong>{keepers.length} saved</strong></header>
      <p className="commissioner-help">Type a manager or team, player, and cost. Press Enter to save. Keepers stay editable after publishing until the draft starts.</p>
      <form aria-label="Add keeper" className="commissioner-inline-form" onSubmit={submit}>
        <TextField
          autoComplete="off"
          disabled={add.isPending}
          id="keeper-command"
          label="Keeper command"
          onChange={event => { setCommand(event.target.value); }}
          placeholder="Hoody keeping Tuten 5"
          value={command}
        />
        <Button
          aria-busy={add.isPending}
          disabled={command.trim().length === 0 || add.isPending}
          type="submit"
        >
          {add.isPending ? "Adding keeper..." : "Add keeper"}
        </Button>
      </form>
      {add.isPending ? <p role="status">Saving keeper and updating league values...</p> : null}
      {add.isSuccess ? <p role="status">Keeper saved.</p> : null}
      {add.isError ? <p role="alert">{errorMessage(add.error)}</p> : null}
      <div className="commissioner-list">
        {keepers.length === 0 ? <p>No keepers added yet.</p> : keepers.map(keeper => {
          const playerId = keeper.playerId;
          return <div key={`${keeper.teamId}-${keeper.playerName}`}>
            <span><strong>{keeper.playerName}</strong><small>{teamNames.get(keeper.teamId) ?? "Team"} · {keeper.position}</small></span>
            <strong>{keeper.keeperRound === undefined ? `$${String(keeper.price)}` : `Round ${String(keeper.keeperRound)}`}</strong>
            {playerId === undefined
              ? <Button disabled variant="secondary">Remove</Button>
              : <Button aria-busy={remove.isPending} onClick={() => {
                remove.mutate({ teamId: keeper.teamId, playerId });
              }} disabled={remove.isPending} variant="secondary">Remove</Button>}
          </div>;
        })}
      </div>
      {remove.isError ? <p role="alert">{errorMessage(remove.error)}</p> : null}
    </section>
  );
}
