import type { Owner } from "../../../config/league.js";
import { AuctionBid, AuctionBidDiagnostics, AuctionBidDriver } from "./auctionContracts.js";
import { AuctionEngineConfig } from "./configContracts.js";

export const ownerIndex = (config: AuctionEngineConfig, owner: Owner): number => {
  const index = config.owners.indexOf(owner);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
};

export const compareBids = (config: AuctionEngineConfig) => (left: AuctionBid, right: AuctionBid): number =>
  right.amount - left.amount ||
  right.uncappedAmount - left.uncappedAmount ||
  left.tieBreak - right.tieBreak ||
  ownerIndex(config, left.owner) - ownerIndex(config, right.owner);

export const bidDriversFor = (bid: AuctionBid): AuctionBidDriver[] => {
  const multipliers = [
    { key: "owner_demand", multiplier: bid.ownerDemandMultiplier },
    { key: "roster_need", multiplier: bid.rosterNeedMultiplier },
    { key: "scarcity", multiplier: bid.behaviorScarcityMultiplier },
    { key: "behavior_aggression", multiplier: bid.behaviorAggressionMultiplier },
    { key: "build_style", multiplier: bid.buildStyleMultiplier },
    { key: "replacement_patience", multiplier: bid.replacementPatienceMultiplier },
    { key: "endgame_pressure", multiplier: bid.endgamePressureMultiplier },
    { key: "room_pressure", multiplier: bid.roomPressureMultiplier },
    { key: "competition_pressure", multiplier: bid.competitionPressureMultiplier },
    { key: "budget_pacing", multiplier: bid.budgetPacingMultiplier },
    { key: "bid_variance", multiplier: bid.bidVarianceMultiplier },
    { key: "top_end_damping", multiplier: bid.topEndDampingMultiplier },
    { key: "position_overbid_damping", multiplier: bid.positionOverbidDampingMultiplier },
    { key: "context_penalty_damping", multiplier: bid.contextPenaltyDampingMultiplier },
  ] satisfies readonly { key: string; multiplier: number }[];

  return multipliers
    .flatMap(({ key, multiplier }) => {
      if (multiplier === 1) return [];
      return [{
        key,
        multiplier,
        direction: multiplier > 1 ? "up" : "down",
      } satisfies AuctionBidDriver];
    })
    .sort((left, right) =>
      Math.abs(right.multiplier - 1) - Math.abs(left.multiplier - 1) ||
      left.key.localeCompare(right.key),
    );
};

export const retainedBidDriversFor = (bid: AuctionBid): AuctionBidDriver[] => {
  const drivers = bidDriversFor(bid);
  const retainedDrivers = drivers.slice(0, 3);
  const contextPenaltyDriver = drivers.find(driver => driver.key === "context_penalty_damping");

  if (
    !contextPenaltyDriver ||
    retainedDrivers.some(driver => driver.key === contextPenaltyDriver.key)
  ) {
    return retainedDrivers;
  }

  return [...retainedDrivers.slice(0, 2), contextPenaltyDriver];
};

export const bidDiagnosticsFor = (bid: AuctionBid): AuctionBidDiagnostics => ({
  owner: bid.owner,
  cappedByMaxBid: bid.amount < bid.uncappedAmount,
  drivers: retainedBidDriversFor(bid),
});
