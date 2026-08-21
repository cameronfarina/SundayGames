import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useState, type ReactNode } from "react";
import { invalidateLeagueSetupConsumers } from "../../../../shared/api/queries/seasonQueryInvalidation";
import { Button } from "../../../../shared/ui/index.js";
import { commissionerApi } from "../../api/commissionerApi";
import type { CommissionerSeason } from "../../api/seasonSchemas";
import type { CommissionerKeeper } from "../../api/workspaceSchemas";
import { applyBlockers } from "../../model/applyBlockers";
import { errorMessage } from "../../model/errorMessage";
import { teamAssignmentSummary } from "../../model/teamAssignmentSummary";
import { teamRosterContent, teamRosterRows, withDraftOrderCommitted, withRowEdited } from "../../model/teamRoster";
import { SnakeRounds } from "./SnakeRounds";
import { TeamKeepers } from "./TeamKeepers";
import "./LeagueSetupSection.css";

interface LeagueSetupSectionProps {
  readonly keepers: readonly CommissionerKeeper[];
  readonly season: CommissionerSeason;
  readonly summaryAction?: ReactNode;
}

const teamPreviewOptions = (seasonId: string, content: string) => queryOptions({
  queryFn: () => commissionerApi.previewTeams(seasonId, content),
  queryKey: ["league-setup-preview", seasonId, content],
  staleTime: Infinity,
});

export function LeagueSetupSection({ keepers, season, summaryAction }: LeagueSetupSectionProps) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState(() => teamRosterRows(season));
  const content = teamRosterContent(rows);
  const apply = useMutation({
    mutationFn: () => commissionerApi.applyTeams(season.id, content),
    onSuccess: async () => { await invalidateLeagueSetupConsumers(queryClient, season.id); },
  });
  const settings = season.settings;
  const blockers = applyBlockers(apply.error);
  const dirty = content !== teamRosterContent(teamRosterRows(season));
  const editRow = (index: number, edit: Parameters<typeof withRowEdited>[2]) => {
    setRows(current => withRowEdited(current, index, edit));
    apply.reset();
  };
  // Renumbering while a manager types would move the box out from under the
  // cursor, so the board settles once the field is left.
  const commitDraftOrder = (index: number) => {
    setRows(current => withDraftOrderCommitted(current, index));
    apply.reset();
  };
  // Asks the server what these rows would do, so the effect of a rename is on
  // screen before it is saved rather than discovered at the draft room.
  const previewContent = useDeferredValue(content);
  const preview = useQuery(teamPreviewOptions(season.id, previewContent));
  // A row that keeps its own team needs no explanation. Listing all fourteen
  // buries the one row that does something, so only changes are shown.
  const assignments = (preview.data?.teamAssignments ?? [])
    .filter(assignment => assignment.effect !== "kept");
  const snake = settings.draftFormat === "snake";
  const keepersEnabled = settings.keeperPolicy.enabled !== false;
  const draftLabel = settings.draftFormat === "auction"
    ? `$${String(settings.auction.budgetDollars)} auction`
    : `${String(settings.snake.rounds)}-round snake`;

  return (
    <section className="commissioner-section" id="league-setup">
      <header><h2>League info</h2></header>
      <div className="commissioner-facts">
        <div><span>Draft</span><strong>{draftLabel}</strong></div>
        <div><span>Scoring</span><strong>{settings.scoring.reception} PPR · {settings.scoring.passingTouchdown} pt pass TD · {settings.scoring.passingYards} pt/pass yd</strong></div>
        <div><span>Number of teams</span><strong aria-label="Number of teams value">{settings.expectedTeamCount}</strong></div>
        {summaryAction}
      </div>
      {settings.draftFormat === "snake" && <SnakeRounds
        rosterSize={settings.roster.rosterSize}
        rounds={settings.snake.rounds}
        seasonId={season.id}
      />}
      <p className="commissioner-help">Scoring and roster rules are read-only after league creation. Edit a manager or team name in place, then apply. {keepersEnabled ? "Keepers save as soon as you add them. " : ""}Everything stays editable until a live room starts.</p>
      <fieldset className="commissioner-teams">
        <legend>Teams and managers</legend>
        <ol className="commissioner-teams__list">
          {rows.map((row, index) => (
            <li className="commissioner-teams__row" key={row.teamId}>
              {snake ? <input
                aria-label={`Draft order ${String(index + 1)}`}
                className="commissioner-teams__pick-input"
                inputMode="numeric"
                onBlur={() => { commitDraftOrder(index); }}
                onChange={event => { editRow(index, { draftOrder: event.target.value }); }}
                value={row.draftOrder}
              /> : <span className="commissioner-teams__pick">{index + 1}</span>}
              <input
                aria-label={`Manager ${String(index + 1)}`}
                onChange={event => { editRow(index, { ownerDisplayName: event.target.value }); }}
                value={row.ownerDisplayName}
              />
              <input
                aria-label={`Team name ${String(index + 1)}`}
                onChange={event => { editRow(index, { teamDisplayName: event.target.value }); }}
                value={row.teamDisplayName}
              />
              {keepersEnabled && (
                <TeamKeepers
                  keepers={keepers.filter(keeper => keeper.teamId === row.teamId)}
                  savedOwnerDisplayName={row.savedOwnerDisplayName}
                  seasonId={season.id}
                  teamId={row.teamId}
                />
              )}
            </li>
          ))}
        </ol>
      </fieldset>
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
