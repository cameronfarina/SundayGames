import { Button } from "../../../../shared/ui/index.js";
import type { AuctionEvent, AuctionNomination } from "../../api/auctionStateSchemas.js";
import { positionAccent } from "../../model/auctionViewModel.js";
import "./AuctionStage.css";

interface AuctionStageProps {
  readonly busy: boolean;
  readonly events: readonly AuctionEvent[];
  readonly humanMaxBid: number;
  readonly nomination?: AuctionNomination;
  readonly onBuy: (price: number) => void;
  readonly onPass: () => void;
}

const eventsForNomination = (
  events: readonly AuctionEvent[],
  nomination: AuctionNomination | undefined,
): readonly AuctionEvent[] => {
  if (nomination === undefined) return events.slice(-8);
  return events.filter(event => event.nominationNumber === nomination.number).slice(-10);
};

export const AuctionStage = ({
  busy,
  events,
  humanMaxBid,
  nomination,
  onBuy,
  onPass,
}: AuctionStageProps) => {
  const visibleEvents = eventsForNomination(events, nomination);
  const countdown = [...visibleEvents].reverse().find(event => event.type === "countdown");
  const activity = visibleEvents.filter(event => event.type !== "countdown");

  return (
    <section
      aria-label="Live auction"
      className={`auction-stage ${positionAccent(nomination?.position ?? "")}`}
    >
      <div className="auction-stage__headline">
        <div>
          <span className="auction-stage__eyebrow">
            {nomination === undefined ? "Your nomination" : nomination.position}
          </span>
          <h2>{nomination?.playerName ?? "Choose the next player"}</h2>
          <p>
            {nomination === undefined
              ? "Use Nominate on the board to open bidding."
              : `Nominated by ${nomination.nominatedByTeamName}`}
          </p>
        </div>
        {nomination !== undefined && (
          <div aria-live="polite" className="auction-stage__bid">
            <strong>Current bid ${String(nomination.currentPrice)}</strong>
            <span>{nomination.highestBidderTeamName} has the high bid</span>
            <span>Your max bid ${String(humanMaxBid)}</span>
          </div>
        )}
      </div>
      {nomination !== undefined && (
        <div className="auction-stage__actions">
          <Button
            disabled={busy || !nomination.humanCanBuy}
            onClick={() => { onBuy(nomination.nextBid); }}
          >
            Bid ${String(nomination.nextBid)}
          </Button>
          <Button disabled={busy || !nomination.humanCanPass} onClick={onPass} variant="secondary">
            Pass
          </Button>
          {countdown?.countdown !== undefined && (
            <strong className="auction-stage__countdown">{String(countdown.countdown)} seconds</strong>
          )}
        </div>
      )}
      <ol aria-label="Auction activity" className="auction-stage__activity">
        {activity.length === 0 && <li>Bids and sales will appear here.</li>}
        {activity.map(event => <li key={event.sequence}>{event.text}</li>)}
      </ol>
    </section>
  );
};
