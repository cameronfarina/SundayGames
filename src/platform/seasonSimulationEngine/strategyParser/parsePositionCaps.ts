import type { SeasonSimulationPositionCap } from "../contracts.js";
import { extract } from "../strategySupport.js";
import { strategicPositionFor } from "./contracts.js";

const positionCapPattern = /\b(?:do\s+not|don't|dont|never)\s+(?:spend|pay)\s+(?:over|more\s+than)\s+\$?(\d+)\s+(?:for|on)\s+(?:(another|any\s+other|other)\s+)?(QB|RB|WR|TE)s?\b/i;

export const parsePositionCaps = (
  initialRemainder: string,
  positionCaps: SeasonSimulationPositionCap[],
): string => {
  let remainder = initialRemainder;
  while (true) {
    const positionCap = extract(remainder, positionCapPattern);
    if (positionCap === undefined) return remainder;
    const maxAuctionPrice = Number(positionCap.match[1]);
    const position = strategicPositionFor(positionCap.match[3]);
    if (
      Number.isSafeInteger(maxAuctionPrice)
      && maxAuctionPrice > 0
      && position !== undefined
    ) {
      positionCaps.push({
        position,
        maxAuctionPrice,
        excludeNamedTargets: positionCap.match[2] !== undefined,
      });
    }
    remainder = positionCap.remainder;
  }
};
