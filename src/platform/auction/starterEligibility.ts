export { isAutomatedAuctionAcquisitionEligible } from "./starterEligibility/acquisitionEligibility.js";
export { maximumAutomatedAuctionBidFor } from "./starterEligibility/maximumBid.js";
export {
  benchOnlySpecialistPositions,
  bestPositiveStarterFallbackFor,
  hasOpenDedicatedStarterSlotFor,
  hasProjectedRbOrWrAlternative,
  hasStarterEligibilitySignalFor,
  openDedicatedStarterDemandFor,
  remainingStarterEligiblePlayersFor,
} from "./starterEligibility/starterPool.js";
export {
  isStarterEligible,
  projectedSeasonProductionFor,
  projectedWeeklyProductionFor,
} from "./starterEligibility/playerProduction.js";
