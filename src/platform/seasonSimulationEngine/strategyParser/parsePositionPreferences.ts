import type { SeasonSimulationPreferredPosition } from "../../seasonSimulationPreferences.js";
import { extract, preferredCount } from "../strategySupport.js";
import { strategicPositionFor } from "./contracts.js";

const countedPreferencePattern = /\b(?:target|prioriti[sz]e|draft)?\s*(\d+|one|two|three|four)\s+(?:elite|top|premium)\s+(QB|RB|WR|TE)s?(?:\s*(?:,|and)?\s*(?:for\s+)?(?:no\s+more\s+than|under|(?:at\s+)?(?:a\s+)?max(?:imum)?(?:\s+price)?(?:\s+of)?)\s*\$?(\d+)(?:\s+(?:for\s+)?each)?)?\b/i;
const singlePreferencePattern = /\b(?:target|prioriti[sz]e|draft)?\s*(?:an?\s+)?(?:elite|top|premium)\s+(QB|RB|WR|TE)\b/i;

export const parseCountedPositionPreference = (
  remainder: string,
  preferences: SeasonSimulationPreferredPosition[],
): string => {
  const preference = extract(remainder, countedPreferencePattern);
  if (preference === undefined) return remainder;

  const targetCount = preferredCount(preference.match[1] ?? "");
  const position = strategicPositionFor(preference.match[2]);
  const maxAuctionPrice = preference.match[3] === undefined
    ? undefined
    : Number(preference.match[3]);
  const validPrice = maxAuctionPrice === undefined
    || (Number.isSafeInteger(maxAuctionPrice) && maxAuctionPrice > 0);
  if (targetCount !== undefined && position !== undefined && validPrice) {
    preferences.push({
      position,
      tier: "elite",
      targetCount,
      ...(maxAuctionPrice === undefined ? {} : { maxAuctionPrice }),
    });
    return preference.remainder;
  }
  return remainder;
};

export const parseSinglePositionPreferences = (
  initialRemainder: string,
  preferences: SeasonSimulationPreferredPosition[],
): string => {
  let remainder = initialRemainder;
  while (true) {
    const preference = extract(remainder, singlePreferencePattern);
    if (preference === undefined) return remainder;
    const position = strategicPositionFor(preference.match[1]);
    if (
      position !== undefined
      && !preferences.some(candidate => candidate.position === position)
    ) {
      preferences.push({ position, tier: "elite" });
    }
    remainder = preference.remainder;
  }
};
