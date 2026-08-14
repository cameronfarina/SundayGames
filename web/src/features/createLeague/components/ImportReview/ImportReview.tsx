import { Button } from "../../../../shared/ui/Button/Button";
import type { EspnReviewOutcome } from "../../api/createLeagueSchemas";
import type { EspnSettingsReview } from "../../model/createLeagueTypes";
import "./ImportReview.css";

interface ImportReviewProps {
  readonly applied: boolean;
  readonly outcome: Extract<EspnReviewOutcome, { readonly kind: "review" }>;
  readonly onApply: (review: EspnSettingsReview) => void;
}

const draftLabel = (review: EspnSettingsReview): string => review.draft.type === "auction"
  ? `$${String(review.draft.budgetDollars)} auction · $${String(review.draft.minimumBidDollars)} minimum bid`
  : `${String(review.draft.rounds)}-round snake`;

const scoringLines = (review: EspnSettingsReview): readonly string[] => [
  `${String(review.scoring.pointsPerReception)} points per reception`,
  `${String(review.scoring.pointsPerPassingYard)} per passing yard · ${String(review.scoring.pointsPerPassingTouchdown)} per passing TD`,
  `${String(review.scoring.pointsPerRushingYard)} per rushing yard · ${String(review.scoring.pointsPerRushingTouchdown)} per rushing TD`,
  `${String(review.scoring.pointsPerReceivingYard)} per receiving yard · ${String(review.scoring.pointsPerReceivingTouchdown)} per receiving TD`,
];

export const ImportReview = ({ applied, outcome, onApply }: ImportReviewProps) => (
  <section aria-label="Imported ESPN settings" className="import-review">
    <header>
      <div>
        <p className="create-league-eyebrow">ESPN import found</p>
        <h3>{outcome.review.leagueName ?? "Unnamed ESPN league"}</h3>
      </div>
      <strong>{String(outcome.review.teamCount)} teams</strong>
    </header>
    <dl>
      <div><dt>Season</dt><dd>{String(outcome.review.season)}</dd></div>
      <div><dt>Draft</dt><dd>{draftLabel(outcome.review)}</dd></div>
      <div><dt>ESPN league ID</dt><dd>{outcome.review.externalLeagueId}</dd></div>
    </dl>
    <div className="import-review__details">
      <section><h4>Scoring</h4>{scoringLines(outcome.review).map(line => <p key={line}>{line}</p>)}</section>
      <section>
        <h4>Roster</h4>
        <p>{Object.entries(outcome.review.rosterSlots).map(([slot, count]) => `${slot} ${String(count)}`).join(" · ")}</p>
      </section>
      <section>
        <h4>Teams</h4>
        <ol>{outcome.review.teams.map(team => <li key={team.externalTeamId}>{team.displayName}</li>)}</ol>
      </section>
    </div>
    {outcome.warnings.map(warning => <p className="import-review__warning" key={warning.code}>{warning.message}</p>)}
    <Button disabled={applied} onClick={() => { onApply(outcome.review); }}>
      {applied ? "Imported settings applied" : "Use imported settings"}
    </Button>
  </section>
);
