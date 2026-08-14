import { primaryOwner, type Owner } from "../../config/league.js";
import { normalizePlayerName } from "../data/normalizePlayerName.js";

export interface MockDraftScriptTargetMaxBid {
  owner: Owner;
  player: string;
  maxBid: number;
}

export interface MockDraftScriptBuildAround {
  owner: Owner;
  player: string;
  prices: number[];
}

export interface MockDraftScript {
  raw: string;
  label: string;
  buildAround?: MockDraftScriptBuildAround;
  targetMaxBids: MockDraftScriptTargetMaxBid[];
  runsPerScenario?: number;
}

const defaultOwner: Owner = primaryOwner;

const cleanPlayerName = (value: string): string =>
  value
    .replace(/,?\s*\bwhere\s+i(?:'m|m| am)?\s*$/i, "")
    .replace(/\bwhere\s+i(?:'m| am)?\s*$/i, "")
    .replace(/\bwhere\s*$/i, "")
    .replace(/\bi(?:'m|m| am)?\s*$/i, "")
    .replace(/\bfor\s*$/i, "")
    .replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, "")
    .trim()
    .replace(/\s+/g, " ");

const normalizedScriptText = (raw: string): string =>
  raw.replace(/[’‘]/g, "'");

const runsPerScenarioFrom = (raw: string): number | undefined => {
  const match = /\b(?:run|running)\s+(\d+)\s+mocks?\b/i.exec(raw) ??
    /^\s*(\d+)\s+mocks?\b/i.exec(raw);
  if (!match) return undefined;

  const count = Number(match[1]);
  return Number.isInteger(count) && count > 0 ? count : undefined;
};

const capMatchFor = (raw: string): RegExpExecArray | undefined =>
  /(?:where\s+)?(?:i(?:'m|m| am)?\s*)?(?:not\s+willing\s+to\s+pay\s+over|not\s+paying\s+over|not\s+over|no\s+more\s+than|up\s+to|max(?:imum)?|cap(?:ped)?(?:\s+at)?|under|<=)\s*\$?(\d+)\b/i.exec(raw) ??
  /:\s*\$?(\d+)\s*$/i.exec(raw) ??
  undefined;

const normalizedPriceSpec = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\$/g, "")
    .replace(/\s+(?:by|step)\s+/g, ":")
    .replace(/\s+to\s+/g, "-")
    .replace(/\b(?:a|an|the|price|band|range|sweep|dollars?)\b/g, "")
    .replace(/\s+/g, "");

const pricesFromSpec = (value: string): number[] | undefined => {
  const spec = normalizedPriceSpec(value);
  const rangeMatch = /^(\d+)-(\d+)(?::(\d+))?$/.exec(spec);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    const step = Number(rangeMatch[3] ?? 1);
    if (!Number.isInteger(start) || !Number.isInteger(end) || !Number.isInteger(step) || start < 1 || end < start || step < 1) {
      return undefined;
    }

    const prices: number[] = [];
    for (let price = start; price <= end; price += step) prices.push(price);
    return prices;
  }

  const prices = spec
    .split(/[,/]+/)
    .map(part => Number(part))
    .filter(price => Number.isInteger(price) && price >= 1);
  return prices.length > 0 ? [...new Set(prices)] : undefined;
};

const targetNameFrom = (rawBeforeCap: string): string => {
  const withoutRunPrefix = rawBeforeCap
    .replace(/\b(?:run|running)\s+\d+\s+mocks?\s+(?:where\s+)?/i, "")
    .trim();
  const targetMatch = /\b(?:target(?:ing)?|try\s+for|chase|get)\s+(.+)$/i.exec(withoutRunPrefix);
  return cleanPlayerName(targetMatch?.[1] ?? withoutRunPrefix);
};

const parseTarget = (raw: string): MockDraftScriptTargetMaxBid | undefined => {
  if (/\b(?:build(?:\s+my)?\s+mocks?\s+around|build\s+around|anchor)\b/i.test(raw)) return undefined;

  const match = capMatchFor(raw);
  if (!match?.[1] || match.index === undefined) return undefined;

  const player = targetNameFrom(raw.slice(0, match.index));
  const maxBid = Number(match[1]);
  if (!player || !Number.isInteger(maxBid) || maxBid < 1) return undefined;

  return { owner: defaultOwner, player, maxBid };
};

const parseBuildAround = (raw: string): MockDraftScriptBuildAround | undefined => {
  const withoutRunPrefix = raw
    .replace(/\b(?:run|running)\s+\d+\s+mocks?\s+(?:where\s+)?/i, "")
    .trim();
  const match = /\b(?:build(?:\s+my)?\s+mocks?\s+around|build\s+around|anchor)\s+(.+?)\s*(?:at|for|:)\s*(.+)$/i
    .exec(withoutRunPrefix);
  if (!match?.[1] || !match[2]) return undefined;

  const player = cleanPlayerName(match[1]);
  const prices = pricesFromSpec(match[2]);
  if (!player || !prices) return undefined;

  return { owner: defaultOwner, player, prices };
};

const scriptParts = (raw: string): string[] =>
  raw
    .split(/[\n;]+/)
    .map(part => part.trim())
    .filter(Boolean);

const scriptLabelFor = (
  targets: readonly MockDraftScriptTargetMaxBid[],
  buildAround?: MockDraftScriptBuildAround,
): string => {
  const parts = [
    ...(buildAround
      ? [`Build around ${buildAround.player} at ${buildAround.prices.map(price => `$${price}`).join("/")}`]
      : []),
    ...targets.map(target => `Target ${target.player} up to $${target.maxBid}`),
  ];
  return parts.join(" / ");
};

const scriptPlayerSearchKey = (value: string): string =>
  normalizePlayerName(value).toLowerCase();

const canonicalPlayerNameFor = (
  player: string,
  playerNames: readonly string[],
): string => {
  const searchKey = scriptPlayerSearchKey(player);
  const exactMatch = playerNames.find(candidate => scriptPlayerSearchKey(candidate) === searchKey);
  if (exactMatch) return normalizePlayerName(exactMatch);

  const partialMatches = playerNames.filter(candidate => scriptPlayerSearchKey(candidate).includes(searchKey));
  if (partialMatches.length > 1) {
    throw new Error(
      `Ambiguous mock script player "${player}": ${partialMatches.slice(0, 6).join(", ")}. Use a full name.`,
    );
  }

  return normalizePlayerName(partialMatches[0] ?? player);
};

export const canonicalizeMockDraftScript = (
  script: MockDraftScript,
  playerNames: readonly string[],
): MockDraftScript => {
  const targetMaxBids = script.targetMaxBids.map(target => ({
    ...target,
    player: canonicalPlayerNameFor(target.player, playerNames),
  }));
  const buildAround = script.buildAround === undefined
    ? undefined
    : {
      ...script.buildAround,
      player: canonicalPlayerNameFor(script.buildAround.player, playerNames),
    };

  return {
    ...script,
    label: scriptLabelFor(targetMaxBids, buildAround),
    ...(buildAround === undefined ? {} : { buildAround }),
    targetMaxBids,
  };
};

export const parseMockDraftScript = (
  rawValue: string,
): MockDraftScript | undefined => {
  const raw = normalizedScriptText(rawValue).trim();
  if (!raw) return undefined;

  const targetMaxBids = scriptParts(raw)
    .map(parseTarget)
    .filter((target): target is MockDraftScriptTargetMaxBid => target !== undefined);
  const buildArounds = scriptParts(raw)
    .map(parseBuildAround)
    .filter((buildAround): buildAround is MockDraftScriptBuildAround => buildAround !== undefined);
  if (targetMaxBids.length === 0 && buildArounds.length === 0) {
    throw new Error("Mock script must include a target or build-around, like \"target Jadarian Price max 20\" or \"build around Omarion Hampton at 46-50:2\".");
  }
  if (buildArounds.length > 1) {
    throw new Error("Mock script can only build around one player at a time.");
  }

  const runsPerScenario = runsPerScenarioFrom(raw);
  const buildAround = buildArounds[0];
  return {
    raw,
    label: scriptLabelFor(targetMaxBids, buildAround),
    ...(buildAround === undefined ? {} : { buildAround }),
    targetMaxBids,
    ...(runsPerScenario === undefined ? {} : { runsPerScenario }),
  };
};
