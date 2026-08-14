import { primaryOwner } from "../../../config/league.js";
import type {
  MockDraftScriptBuildAround,
  MockDraftScriptTargetMaxBid,
} from "./contracts.js";
import { pricesFromSpec } from "./prices.js";
import { cleanPlayerName, withoutRunPrefix } from "./text.js";

const capMatchFor = (raw: string): RegExpExecArray | undefined =>
  /(?:where\s+)?(?:i(?:'m|m| am)?\s*)?(?:not\s+willing\s+to\s+pay\s+over|not\s+paying\s+over|not\s+over|no\s+more\s+than|up\s+to|max(?:imum)?|cap(?:ped)?(?:\s+at)?|under|<=)\s*\$?(\d+)\b/i.exec(raw) ??
  /:\s*\$?(\d+)\s*$/i.exec(raw) ??
  undefined;

const targetNameFrom = (rawBeforeCap: string): string => {
  const targetMatch = /\b(?:target(?:ing)?|try\s+for|chase|get)\s+(.+)$/i
    .exec(withoutRunPrefix(rawBeforeCap));
  return cleanPlayerName(targetMatch?.[1] ?? withoutRunPrefix(rawBeforeCap));
};

export const parseTarget = (raw: string): MockDraftScriptTargetMaxBid | undefined => {
  if (/\b(?:build(?:\s+my)?\s+mocks?\s+around|build\s+around|anchor)\b/i.test(raw)) {
    return undefined;
  }
  const match = capMatchFor(raw);
  if (!match?.[1] || match.index === undefined) return undefined;
  const player = targetNameFrom(raw.slice(0, match.index));
  const maxBid = Number(match[1]);
  return !player || !Number.isInteger(maxBid) || maxBid < 1
    ? undefined
    : { owner: primaryOwner, player, maxBid };
};

export const parseBuildAround = (raw: string): MockDraftScriptBuildAround | undefined => {
  const match = /\b(?:build(?:\s+my)?\s+mocks?\s+around|build\s+around|anchor)\s+(.+?)\s*(?:at|for|:)\s*(.+)$/i
    .exec(withoutRunPrefix(raw));
  if (!match?.[1] || !match[2]) return undefined;
  const player = cleanPlayerName(match[1]);
  const prices = pricesFromSpec(match[2]);
  return !player || !prices ? undefined : { owner: primaryOwner, player, prices };
};
