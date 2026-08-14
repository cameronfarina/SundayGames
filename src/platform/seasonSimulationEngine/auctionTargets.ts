export {
  auctionProjectedWeeklyProductionFor,
  auctionRosterNeedFor,
  needsDedicatedStarterFor,
} from "./auctionTargets/playerNeeds.js";
export { targetsFor } from "./auctionTargets/strategyTargets.js";
export {
  canAuctionTeamAcquire,
  canAuctionTeamRoster,
} from "./auctionTargets/acquisitionEligibility.js";
export { preservesSlotsForTargets } from "./auctionTargets/slotReservations.js";
export {
  minimumTargetAcquisitionCostFor,
  plannedFutureTargetsFor,
} from "./auctionTargets/targetPlanning.js";
