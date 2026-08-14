import { cleanPlayerName, extract } from "../strategySupport.js";
import type { TargetCandidate } from "./contracts.js";

const namedTargetPattern = /\b(?:draft|target|prioriti[sz]e)\s+([a-z][a-z.'-]*(?:\s+(?!(?:and|to)\b|(?:and\s+)?(?:draft|target|prioriti[sz]e)\b)[a-z0-9][a-z0-9.'-]*){0,4}?)(?=\s*(?:(?:[.;,]\s*)(?:(?:draft|target|prioriti[sz]e)\b|$)|and\s+(?:draft|target|prioriti[sz]e)\b|(?:and|to)\b|$))/i;

export const parseNamedTargets = (
  initialRemainder: string,
  candidates: TargetCandidate[],
): string => {
  let remainder = initialRemainder;
  while (true) {
    const namedTarget = extract(remainder, namedTargetPattern);
    if (namedTarget === undefined) return remainder;
    const playerName = cleanPlayerName(namedTarget.match[1] ?? "");
    if (playerName.length > 0) {
      candidates.push({ index: namedTarget.index, target: { playerName } });
    }
    remainder = namedTarget.remainder;
  }
};
