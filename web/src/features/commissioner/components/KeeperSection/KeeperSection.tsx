import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type SyntheticEvent } from "react";
import { commissionerApi } from "../../api/commissionerApi";
import type { CommissionerSeason } from "../../api/seasonSchemas";
import type { CommissionerKeeper } from "../../api/workspaceSchemas";
import { errorMessage } from "../../model/errorMessage";
import { commissionerKeys } from "../../pages/CommissionerPage/hooks/useCommissionerWorkspace";

interface KeeperSectionProps {
  readonly keepers: readonly CommissionerKeeper[];
  readonly season: CommissionerSeason;
}

interface KeeperIdentity { readonly playerId: string; readonly teamId: string }

export function KeeperSection({ keepers, season }: KeeperSectionProps) {
  const [command, setCommand] = useState("");
  const queryClient = useQueryClient();
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: commissionerKeys.keepers(season.id) });
  };
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
        <label htmlFor="keeper-command">Keeper command</label>
        <input id="keeper-command" value={command} onChange={event => { setCommand(event.target.value); }}
          placeholder="Hoody keeping Tuten 5" autoComplete="off" disabled={add.isPending} />
        <button className="commissioner-primary" disabled={command.trim().length === 0 || add.isPending}>Add keeper</button>
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
              ? <button type="button" disabled>Remove</button>
              : <button type="button" onClick={() => {
                remove.mutate({ teamId: keeper.teamId, playerId });
              }} disabled={remove.isPending}>Remove</button>}
          </div>;
        })}
      </div>
      {remove.isError ? <p role="alert">{errorMessage(remove.error)}</p> : null}
    </section>
  );
}
