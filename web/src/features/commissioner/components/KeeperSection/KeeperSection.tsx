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

export function KeeperSection({ keepers, season }: KeeperSectionProps) {
  const [command, setCommand] = useState("");
  const queryClient = useQueryClient();
  const refresh = async () => { await invalidateKeeperConsumers(queryClient, season.id); };
  const add = useMutation({
    mutationFn: () => commissionerApi.addKeeper(season.id, command.trim()),
    onSuccess: async () => { setCommand(""); await refresh(); },
  });
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (command.trim().length > 0) add.mutate();
  };

  return (
    <section className="commissioner-section" id="keepers">
      <header><div><span>02</span><h2>Keepers</h2></div><strong>{keepers.length} saved</strong></header>
      <p className="commissioner-help">Add several keepers quickly from here, or use the + Keeper button on a team above. Each keeper appears on its team's row.</p>
      <form aria-label="Add keeper" className="commissioner-inline-form" onSubmit={submit}>
        <TextField
          autoComplete="off"
          disabled={add.isPending}
          id="keeper-command"
          label="Keeper command"
          onChange={event => { setCommand(event.target.value); }}
          placeholder="Owner02 keeping Tuten 5"
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
    </section>
  );
}
