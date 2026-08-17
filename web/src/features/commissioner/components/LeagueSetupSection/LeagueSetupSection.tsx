import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { invalidateLeagueSetupConsumers } from "../../../../shared/api/queries/seasonQueryInvalidation";
import { Button } from "../../../../shared/ui/index.js";
import { commissionerApi } from "../../api/commissionerApi";
import type { CommissionerSeason } from "../../api/seasonSchemas";
import { applyBlockers } from "../../model/applyBlockers";
import { errorMessage } from "../../model/errorMessage";
import { teamAssignmentSummary } from "../../model/teamAssignmentSummary";

interface LeagueSetupSectionProps { readonly season: CommissionerSeason }

const teamPreviewOptions = (seasonId: string, content: string) => queryOptions({
  queryFn: () => commissionerApi.previewTeams(seasonId, content),
  queryKey: ["league-setup-preview", seasonId, content],
  staleTime: Infinity,
});

const teamRows = (season: CommissionerSeason): string => [
  "owner,team,role",
  ...[...season.teams]
    .sort((left, right) => left.draftOrderPosition - right.draftOrderPosition)
    .map(team => `${team.ownerDisplayName},${team.displayName},member`),
].join("\n");

export function LeagueSetupSection({ season }: LeagueSetupSectionProps) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState(() => teamRows(season));
  const apply = useMutation({
    mutationFn: () => commissionerApi.applyTeams(season.id, content),
    onSuccess: async () => { await invalidateLeagueSetupConsumers(queryClient, season.id); },
  });
  const settings = season.settings;
  const blockers = applyBlockers(apply.error);
  const dirty = content !== teamRows(season);
  // Asks the server what these rows would do, so the effect of a rename is on
  // screen before it is saved rather than discovered at the draft room.
  const previewContent = useDeferredValue(content);
  const preview = useQuery(teamPreviewOptions(season.id, previewContent));
  const assignments = preview.data?.teamAssignments ?? [];
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
        onChange={event => { setContent(event.target.value); apply.reset(); }} />
      {assignments.length > 0 && (
        <ul aria-label="What these rows will do" className="commissioner-assignments">
          {assignments.map(assignment => (
            <li
              className={`commissioner-assignments__item commissioner-assignments__item--${assignment.effect}`}
              key={assignment.sourceRowNumber}
            >
              {teamAssignmentSummary(assignment)}
            </li>
          ))}
        </ul>
      )}
      <div className="commissioner-actions">
        <Button
          aria-busy={apply.isPending}
          disabled={!dirty || apply.isPending}
          onClick={() => { apply.mutate(); }}
        >
          {apply.isPending ? "Applying..." : "Apply changes"}
        </Button>
      </div>
      {blockers.map(blocker => <p role="alert" key={`${blocker.code}-${String(blocker.rowNumber ?? 0)}`}>{blocker.message}</p>)}
      {apply.isSuccess ? <p role="status">League teams saved.</p> : null}
      {apply.isError && blockers.length === 0 ? <p role="alert">{errorMessage(apply.error)}</p> : null}
    </section>
  );
}
