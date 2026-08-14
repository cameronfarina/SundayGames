import { threeRbPathRules } from "../../draftPlan.js";
import type {
  LiveDraftOwnerState,
  LiveDraftPathPriceBand,
  LiveDraftPathRiskAlert,
  LiveDraftReadinessStatus,
  LiveDraftRosterSlotKey,
} from "../contracts.js";
import { ownerPositionSpend } from "../strategyValuation.js";
import { priceBandText } from "./priceBands.js";

const openStarterSlotsFor = (
  owner: LiveDraftOwnerState,
  slots: readonly LiveDraftRosterSlotKey[],
): number => owner.slots.filter(slot => slots.includes(slot.slot) && !slot.player).length;

const riskStatusFor = (failed: boolean, warned: boolean): LiveDraftReadinessStatus => {
  if (failed) return "fail";
  if (warned) return "warn";
  return "pass";
};

export const threeRbRiskAlertsFor = (
  watchOwner: LiveDraftOwnerState,
  maxPriceBands: readonly LiveDraftPathPriceBand[],
): LiveDraftPathRiskAlert[] => {
  const coreBudget = threeRbPathRules.rbCoreBudget;
  const rbCoreSpend = ownerPositionSpend(watchOwner, "RB");
  const rbCoreFilled = Math.min(watchOwner.positionCounts.RB, coreBudget.targetCount);
  const openCoreRbSlots = Math.max(0, coreBudget.targetCount - rbCoreFilled);
  const rbBudgetRemaining = Math.max(0, coreBudget.hardBudget - rbCoreSpend);
  const futureRbReserve = openCoreRbSlots * coreBudget.minimumFutureCorePrice;
  const nextRbBand = maxPriceBands.find(band => band.position === "RB" && band.status === "next");
  const wrBands = maxPriceBands.filter(band => band.position === "WR");
  const openWrStarterSlots = openStarterSlotsFor(watchOwner, ["WR1", "WR2"]);
  const wrBandText = wrBands.map(priceBandText).join(" / ");
  const dollarSlotCount = Math.max(0, watchOwner.rosterSlotsRemaining - 4);

  return [
    {
      label: "RB budget remaining",
      status: riskStatusFor(
        openCoreRbSlots > 0 && rbBudgetRemaining < futureRbReserve,
        openCoreRbSlots > 0 && nextRbBand !== undefined
          && rbBudgetRemaining < nextRbBand.minimumPrice + futureRbReserve,
      ),
      detail: openCoreRbSlots > 0
        ? `${priceBandText({ minimumPrice: 0, maximumPrice: rbBudgetRemaining })} left for ${openCoreRbSlots} core RB slots; next RB lane is ${nextRbBand ? priceBandText(nextRbBand) : "unavailable"}.`
        : `Core RB slots are filled at $${rbCoreSpend}; stop buying meaningful RB depth unless value falls hard.`,
    },
    {
      label: "WR value pocket",
      status: riskStatusFor(false, openWrStarterSlots > 0 && watchOwner.budgetRemaining < 30),
      detail: openWrStarterSlots > 0
        ? `Keep WR starters in ${wrBandText || "$12-$26"} while the RB core is unfinished.`
        : "WR starters are filled; use the board for value depth only.",
    },
    {
      label: "Roster thinness",
      status: riskStatusFor(false, dollarSlotCount >= 9),
      detail: `${watchOwner.rosterSlotsRemaining} slots remain with max bid $${watchOwner.maxBid}; avoid turning too many bench spots into $1 fixes.`,
    },
  ];
};
