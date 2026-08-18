export const auctionClearingPriceCushionDollars = 2;
// Kickers and defenses always clear at the minimum bid. No team spends a
// budget down onto them, however much money is left in the room.
export const flatPricedAuctionPositions = new Set(["K", "DST"]);
// Once a team's dedicated starter slot at a specialist position is filled,
// backups there are worth a few dollars at most.
export const backupDepthBidCushionDollars = 2;
// A "stud" for bidding-style purposes: owners with a stud-avoiding history
// discount players from this value up, and only those.
export const premiumValueThresholdDollars = 40;
