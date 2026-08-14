import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { invalidateLeagueSetupConsumers } from "../../../../shared/api/queries/seasonQueryInvalidation";
import { Button } from "../../../../shared/ui/index.js";
import { commissionerApi } from "../../api/commissionerApi";
import type { CommissionerSeason } from "../../api/seasonSchemas";
import { errorMessage } from "../../model/errorMessage";

interface LeagueSetupSectionProps { readonly season: CommissionerSeason }

const teamRows = (season: CommissionerSeason): string => [
  "owner,team,role",
  ...[...season.teams]
    .sort((left, right) => left.draftOrderPosition - right.draftOrderPosition)
    .map(team => `${team.ownerDisplayName},${team.displayName},member`),
].join("\n");

export function LeagueSetupSection({ season }: LeagueSetupSectionProps) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState(() => teamRows(season));
  const preview = useMutation({ mutationFn: () => commissionerApi.previewTeams(season.id, content) });
  const apply = useMutation({
    mutationFn: () => commissionerApi.applyTeams(season.id, content),
    onSuccess: async () => { await invalidateLeagueSetupConsumers(queryClient, season.id); },
  });
  const settings = season.settings;
  const previewReady = preview.data?.import.status === "ready";
  const draftLabel = settings.draftFormat === "auction"
    ? `$${String(settings.auction.budgetDollars)} auction`
    : `${String(settings.snake.rounds)}-round snake`;

  return (
    <section className="commissioner-section" id="league-setup">
      <header><div><span>01</span><h2>League info</h2></div><strong>{season.setupStatus}</strong></header>
      <div className="commissioner-facts">
        <div><span>Draft</span><strong>{draftLabel}</strong></div>
        <div><span>Scoring</span><strong>{settings.scoring.reception} PPR · {settings.scoring.passingTouchdown} pt pass TD</strong></div>
        <div><span>Roster</span><strong>{settings.roster.rosterSize} players · {settings.expectedTeamCount} teams</strong></div>
      </div>
      <p className="commissioner-help">Scoring and roster rules are read-only after league creation. Team names and managers remain editable until a live room starts.</p>
      <label htmlFor="commissioner-team-rows">Teams and managers</label>
      <textarea id="commissioner-team-rows" rows={Math.min(10, season.teams.length + 1)} value={content}
        onChange={event => { setContent(event.target.value); preview.reset(); apply.reset(); }} />
      <div className="commissioner-actions">
        <Button
          aria-busy={preview.isPending}
          disabled={preview.isPending}
          onClick={() => { preview.mutate(); }}
          variant="secondary"
        >
          {preview.isPending ? "Previewing..." : "Preview changes"}
        </Button>
        <Button
          aria-busy={apply.isPending}
          disabled={!previewReady || apply.isPending}
          onClick={() => { apply.mutate(); }}
        >
          {apply.isPending ? "Applying..." : "Apply changes"}
        </Button>
      </div>
      {preview.data?.import.blockers.map(blocker => <p role="alert" key={`${blocker.code}-${String(blocker.rowNumber ?? 0)}`}>{blocker.message}</p>)}
      {preview.data?.import.status === "ready" && !apply.isSuccess
        ? <p role="status">Ready to apply {String(preview.data.import.records.length)} teams.</p>
        : null}
      {apply.isSuccess ? <p role="status">League teams saved.</p> : null}
      {preview.isError ? <p role="alert">{errorMessage(preview.error)}</p> : null}
      {apply.isError ? <p role="alert">{errorMessage(apply.error)}</p> : null}
    </section>
  );
}
