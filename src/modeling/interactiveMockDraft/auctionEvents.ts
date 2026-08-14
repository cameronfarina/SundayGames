import type { Owner } from "../../../config/league.js";
import type {
  InteractiveMockDraftAuctionEvent,
  InteractiveMockDraftAuctionEventType,
} from "./contracts.js";

export const aiSaleCommandFor = (
  owner: Owner,
  player: string,
  price: number,
): string => `${owner} drafted ${player} for ${price}`;

export const dollarText = (amount: number): string => `$${amount}`;

export const auctionEvent = ({
  type,
  text,
  owner,
  amount,
  countdown,
}: {
  type: InteractiveMockDraftAuctionEventType;
  text: string;
  owner?: Owner;
  amount?: number;
  countdown?: number;
}): InteractiveMockDraftAuctionEvent => ({
  type,
  text,
  ...(owner === undefined ? {} : { owner }),
  ...(amount === undefined ? {} : { amount }),
  ...(countdown === undefined ? {} : { countdown }),
});

export const bidEventFor = (
  owner: Owner,
  amount: number,
): InteractiveMockDraftAuctionEvent => auctionEvent({
  type: "bid",
  owner,
  amount,
  text: `${owner} bid ${dollarText(amount)}`,
});

export const countdownAndSoldEventsFor = (
  owner: Owner,
  price: number,
): InteractiveMockDraftAuctionEvent[] => [
  ...[5, 4, 3, 2, 1].map(countdown =>
    auctionEvent({ type: "countdown", countdown, text: String(countdown) })
  ),
  auctionEvent({
    type: "sold",
    owner,
    amount: price,
    text: `Sold to ${owner} for ${dollarText(price)}`,
  }),
];
