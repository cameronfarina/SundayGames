import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "../../../../shared/ui/index.js";
import { invalidateLeagueSetupConsumers } from "../../../../shared/api/queries/seasonQueryInvalidation";
import { commissionerApi } from "../../api/commissionerApi";
import { errorMessage } from "../../model/errorMessage";

interface SnakeRoundsProps {
  readonly rosterSize: number;
  readonly rounds: number;
  readonly seasonId: string;
}

export function SnakeRounds({ rosterSize, rounds, seasonId }: SnakeRoundsProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(String(rounds));
  const save = useMutation({
    mutationFn: () => commissionerApi.setSnakeRounds(seasonId, Number(draft)),
    onSuccess: async () => { await invalidateLeagueSetupConsumers(queryClient, seasonId); },
  });
  const value = Number(draft);
  const valid = Number.isInteger(value) && value >= 1 && value <= rosterSize;

  return (
    <div className="commissioner-inline-form">
      <label htmlFor="snake-rounds">Draft rounds</label>
      <input
        className="commissioner-date-input"
        id="snake-rounds"
        inputMode="numeric"
        onChange={event => { setDraft(event.target.value); save.reset(); }}
        value={draft}
      />
      <Button
        aria-busy={save.isPending}
        disabled={!valid || value === rounds || save.isPending}
        onClick={() => { save.mutate(); }}
        variant="secondary"
      >
        {save.isPending ? "Saving..." : "Save rounds"}
      </Button>
      {!valid && <p role="alert">Use a whole number between 1 and {rosterSize}.</p>}
      {save.isError && <p role="alert">{errorMessage(save.error)}</p>}
      {save.isSuccess && <p role="status">Draft rounds saved.</p>}
    </div>
  );
}
