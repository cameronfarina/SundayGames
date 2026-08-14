import type {
  DraftPlanContingencyPlan,
  DraftPlanSlotBlueprint,
} from "../contracts.js";

const blueprintBySlot = (
  blueprint: readonly DraftPlanSlotBlueprint[],
): ReadonlyMap<string, DraftPlanSlotBlueprint> =>
  new Map(blueprint.map(slot => [slot.slot, slot]));

const targetText = (names: readonly string[]): string =>
  names.length ? names.slice(0, 5).join(" / ") : "the next value tier";

const fallbackActionText = (slots: readonly DraftPlanSlotBlueprint[]): string => {
  const fallbackPlans = slots.flatMap(slot =>
    slot.fallbackNames.length
      ? [`${slot.slot} fallback ${slot.fallbackPriceBand}: ${targetText(slot.fallbackNames)}`]
      : []
  );
  return fallbackPlans.length ? ` ${fallbackPlans.join("; ")}` : "";
};

export const contingencyPlansFor = (
  blueprint: readonly DraftPlanSlotBlueprint[],
): DraftPlanContingencyPlan[] => {
  const bySlot = blueprintBySlot(blueprint);
  const rb1 = bySlot.get("RB1");
  const rb2 = bySlot.get("RB2");
  const rb3 = bySlot.get("RB3");
  const wr1 = bySlot.get("WR1");
  const wr2 = bySlot.get("WR2");
  const te = bySlot.get("TE");
  const plans: DraftPlanContingencyPlan[] = [];

  if (rb1 && rb2 && rb3) {
    plans.push({
      label: "After elite RB spend",
      trigger: `RB1 lands in ${rb1.priceBand}.`,
      action: `Preserve RB2 ${rb2.priceBand} and RB3 ${rb3.priceBand}; target ${targetText([...rb2.targetNames, ...rb3.targetNames])}.${fallbackActionText([rb2, rb3])}`,
      targetNames: [...new Set([...rb2.targetNames, ...rb3.targetNames])].slice(0, 5),
      priceBand: `${rb2.priceBand} / ${rb3.priceBand}`,
    });
  }

  if (rb2 && rb3 && wr1) {
    plans.push({
      label: "RB2 pocket closes",
      trigger: `The RB2 tier clears above ${rb2.priceBand}.`,
      action: `Do not chase the miss; move WR1 into ${wr1.priceBand} and keep RB3 opportunistic at ${rb3.priceBand}.${fallbackActionText([wr1, rb3])}`,
      targetNames: [...new Set([...wr1.targetNames, ...rb3.targetNames])].slice(0, 5),
      priceBand: `${wr1.priceBand} / ${rb3.priceBand}`,
    });
  }

  if (wr1 && wr2) {
    plans.push({
      label: "WR value pocket",
      trigger: `WR starters are available in ${wr1.priceBand} and ${wr2.priceBand}.`,
      action: `Draft WR1 from ${targetText(wr1.targetNames)} and WR2 from ${targetText(wr2.targetNames)} instead of solving receiver with one panic spend.${fallbackActionText([wr1, wr2])}`,
      targetNames: [...new Set([...wr1.targetNames, ...wr2.targetNames])].slice(0, 5),
      priceBand: `${wr1.priceBand} / ${wr2.priceBand}`,
    });
  }

  if (te) {
    plans.push({
      label: "TE risk control",
      trigger: `TE remains in ${te.priceBand} in the best sampled builds.`,
      action: `Keep TE cheap unless an earlier RB or WR slot comes in below plan; target ${targetText(te.targetNames)}.${fallbackActionText([te])}`,
      targetNames: te.targetNames,
      priceBand: te.priceBand,
    });
  }

  return plans;
};
