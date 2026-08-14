import { cleanPlayerName, extract } from "../strategySupport.js";
import type { TargetCandidate } from "./contracts.js";

const auctionTargetPattern = /\b(?:draft|target)\s+([a-z][a-z.'-]*(?:\s+(?!(?:and\s+)?(?:draft|target)\b)[a-z0-9][a-z0-9.'-]*){0,4}?)\s+(?:for\s+)?(no\s+more\s+than|under|(?:at\s+)?(?:a\s+)?max(?:imum)?(?:\s+price)?(?:\s+of)?)\s*\$(\d+)\b/i;

export const parseAuctionTargets = (
  initialRemainder: string,
  candidates: TargetCandidate[],
): string => {
  let remainder = initialRemainder;
  while (true) {
    const auctionTarget = extract(remainder, auctionTargetPattern);
    if (auctionTarget === undefined) return remainder;
    const playerName = cleanPlayerName(auctionTarget.match[1] ?? "");
    const strictMaximum = auctionTarget.match[2]?.toLowerCase() === "under";
    const maxAuctionPrice = Number(auctionTarget.match[3]) - (strictMaximum ? 1 : 0);
    if (playerName.length > 0 && Number.isSafeInteger(maxAuctionPrice) && maxAuctionPrice > 0) {
      candidates.push({
        index: auctionTarget.index,
        target: { playerName, maxAuctionPrice },
      });
    }
    remainder = auctionTarget.remainder;
  }
};
