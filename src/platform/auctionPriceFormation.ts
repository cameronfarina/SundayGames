export interface AuctionBidderIdentity {
  id: string;
}

export interface AuctionBidMaximum<TBidder extends AuctionBidderIdentity> {
  team: TBidder;
  maximum: number;
}

export interface CompetitiveAuctionBid<TBidder extends AuctionBidderIdentity> {
  team: TBidder;
  price: number;
}

export const competitiveAuctionBidFor = <TBidder extends AuctionBidderIdentity>(input: {
  currentPrice: number;
  highestBidderTeamId: string;
  maximums: readonly AuctionBidMaximum<TBidder>[];
}): CompetitiveAuctionBid<TBidder> | undefined => {
  const leader = input.maximums[0];
  if (leader === undefined) return undefined;

  const requiredPrice = leader.team.id === input.highestBidderTeamId
    ? input.currentPrice
    : input.currentPrice + 1;
  if (leader.maximum < requiredPrice) return undefined;

  const secondMaximum = input.maximums
    .filter(entry => entry.team.id !== leader.team.id)
    .reduce((maximum, entry) => Math.max(maximum, entry.maximum), 0);

  return {
    team: leader.team,
    price: Math.min(
      leader.maximum,
      Math.max(requiredPrice, secondMaximum + 1),
    ),
  };
};
