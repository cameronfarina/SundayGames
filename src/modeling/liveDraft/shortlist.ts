import type { LiveDraftShortlistTarget, LiveDraftTarget } from "./contracts.js";

const shortlistReasonsFor = (target: LiveDraftTarget): string[] => {
  const reasons: string[] = [];
  const valueGap = target.personalValue - target.liveExpectedPrice;
  if (valueGap >= 6) reasons.push(`value +$${Math.round(valueGap)}`);
  for (const tag of target.tags) {
    if (tag === "starter need" || tag === "3RB core" || tag === "flex need") reasons.push(tag);
  }
  if (target.liveExpectedPrice >= 40 && !target.tags.includes("not affordable")) {
    reasons.push("premium target");
  }
  return [...new Set(reasons)];
};

export const buildShortlist = (
  targets: readonly LiveDraftTarget[],
): LiveDraftShortlistTarget[] => [...targets]
  .filter(target => !target.tags.includes("not affordable"))
  .filter(target => shortlistReasonsFor(target).length > 0)
  .sort((left, right) =>
    right.valueScore - left.valueScore
    || right.liveExpectedPrice - left.liveExpectedPrice
    || right.seasonProjection - left.seasonProjection
    || left.name.localeCompare(right.name))
  .slice(0, 10)
  .map(target => ({
    name: target.name,
    position: target.position,
    ...(target.teamAbbreviation === undefined ? {} : { teamAbbreviation: target.teamAbbreviation }),
    ...(target.byeWeek === undefined ? {} : { byeWeek: target.byeWeek }),
    liveExpectedPrice: target.liveExpectedPrice,
    personalValue: target.personalValue,
    recommendedMaxBid: target.recommendedMaxBid,
    valueGap: target.personalValue - target.liveExpectedPrice,
    valueScore: target.valueScore,
    reasons: shortlistReasonsFor(target),
  }));
