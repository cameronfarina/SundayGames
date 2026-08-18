export const auctionClearingPriceCushionDollars = 2;
// Kickers and defenses always cost two dollars. No team spends a budget
// down onto them, however much money is left in the room.
export const flatPricedAuctionPositions = new Set(["K", "DST"]);
export const flatPricedAuctionDollars = 2;
// A cheap backup quarterback is a half-the-room habit, per league history.
// Willing teams do not always land one, so the willingness share runs higher
// than the target so that roughly half the room actually finishes with two.
export const backupQuarterbackTeamShare = 0.75;
// Once a team's dedicated starter slot at a specialist position is filled,
// backups there are worth a few dollars at most.
export const backupDepthBidCushionDollars = 2;
// A "stud" for bidding-style purposes: owners with a stud-avoiding history
// discount players from this value up, and only those.
export const premiumValueThresholdDollars = 40;
// No owner ever bids past this share of the budget on one player. League
// history tops out at $81 of $200.
export const maximumSingleBidBudgetShare = 0.4;
