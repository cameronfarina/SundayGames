import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { invalidateLeagueSetupConsumers } from "../../../../shared/api/queries/seasonQueryInvalidation";
import { Button } from "../../../../shared/ui/index.js";
import { commissionerApi } from "../../api/commissionerApi";
import { applyBlockers } from "../../model/applyBlockers";
import { errorMessage } from "../../model/errorMessage";

interface TeamListPasteProps { readonly seasonId: string }

/**
 * Seeds a league and sets manager emails and roles, which the row editor above
 * cannot reach. Pasted rows carry no team ids, so they are matched by name and
 * draft slot the way they always were.
 */
export function TeamListPaste({ seasonId }: TeamListPasteProps) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const replace = useMutation({
    mutationFn: () => commissionerApi.applyTeams(seasonId, content),
    onSuccess: async () => { await invalidateLeagueSetupConsumers(queryClient, seasonId); },
  });
  const blockers = applyBlockers(replace.error);

  return (
    <details className="commissioner-paste">
      <summary>Paste a full team list</summary>
      <p className="commissioner-help">Use this to set up a league, or to set manager emails and roles. Rows here are matched by name and draft slot, so rename a manager in the list above instead.</p>
      <label htmlFor="commissioner-team-rows">Teams and managers</label>
      <textarea
        id="commissioner-team-rows"
        onChange={event => { setContent(event.target.value); replace.reset(); }}
        rows={6}
        value={content}
      />
      <Button
        aria-busy={replace.isPending}
        disabled={content.trim().length === 0 || replace.isPending}
        onClick={() => { replace.mutate(); }}
      >
        {replace.isPending ? "Replacing..." : "Replace team list"}
      </Button>
      {blockers.map(blocker => <p role="alert" key={`${blocker.code}-${String(blocker.rowNumber ?? 0)}`}>{blocker.message}</p>)}
      {replace.isSuccess ? <p role="status">League teams saved.</p> : null}
      {replace.isError && blockers.length === 0 ? <p role="alert">{errorMessage(replace.error)}</p> : null}
    </details>
  );
}
