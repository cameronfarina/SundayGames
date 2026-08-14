import type { SeasonSimulationPreferredPosition } from "../seasonSimulationPreferences.js";
import type { SeasonSimulationTargetConstraint } from "../seasonSimulationTargets.js";
import type {
  ParsedSeasonSimulationStrategy,
  SeasonSimulationPositionCap,
} from "./contracts.js";

interface ExtractedMatch {
  index: number;
  match: RegExpMatchArray;
  remainder: string;
}

export const extract = (value: string, pattern: RegExp): ExtractedMatch | undefined => {
  const match = value.match(pattern);
  if (match === null || match.index === undefined) return undefined;

  return {
    index: match.index,
    match,
    remainder: `${value.slice(0, match.index)}${" ".repeat(match[0].length)}${value.slice(match.index + match[0].length)}`,
  };
};
export const cleanPlayerName = (value: string): string => value
  .trim()
  .replace(/\s+/g, " ")
  .replace(/[.,;:]+$/g, "");

export const unsupportedWarning = (value: string): string | undefined => {
  const remainder = value
    .replace(/\brun\s+\d+\s+(?:mock\s+)?simulations?\s+(?:where\s+)?(?:i\s+)?/gi, " ")
    .replace(/\b(?:where|i|please|and|to|a|an|the|draft)\b/gi, " ")
    .replace(/[^a-z0-9$'-]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");

  return remainder.length === 0 ? undefined : `Unsupported strategy phrase: "${remainder}".`;
};

export const summaryFor = (
  targets: readonly SeasonSimulationTargetConstraint[],
  preferredPositions: readonly SeasonSimulationPreferredPosition[],
  positionCaps: readonly SeasonSimulationPositionCap[],
  pairWithPlayerName: string | undefined,
): string => {
  const clauses: string[] = [];
  for (const target of targets) {
    if (target.maxAuctionPrice !== undefined) {
      clauses.push(`target ${target.playerName} up to $${target.maxAuctionPrice}`);
    } else if (target.maxSnakeRound !== undefined) {
      clauses.push(`target ${target.playerName} by round ${target.maxSnakeRound}`);
    } else if (target.maxSnakeOverallPick !== undefined) {
      clauses.push(`target ${target.playerName} by pick ${target.maxSnakeOverallPick}`);
    } else {
      clauses.push(`target ${target.playerName}`);
    }
  }
  for (const preference of preferredPositions) {
    const count = preference.targetCount === undefined ? "" : `${preference.targetCount} `;
    const cap = preference.maxAuctionPrice === undefined
      ? ""
      : ` up to $${preference.maxAuctionPrice} each`;
    clauses.push(`prioritize ${count}${preference.tier} ${preference.position}${cap}`);
  }
  for (const positionCap of positionCaps) {
    clauses.push(
      `cap ${positionCap.excludeNamedTargets ? "other " : ""}${positionCap.position}s at $${positionCap.maxAuctionPrice}`,
    );
  }
  if (pairWithPlayerName !== undefined) clauses.push(`pair with ${pairWithPlayerName}`);

  if (clauses.length === 0) return "Best available roster fit.";
  const summary = clauses.join("; ");
  return `${summary.charAt(0).toUpperCase()}${summary.slice(1)}.`;
};

export const preferredCount = (value: string): number | undefined => {
  const namedCounts: Readonly<Record<string, number>> = { one: 1, two: 2, three: 3, four: 4 };
  const parsed = namedCounts[value.toLowerCase()] ?? Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};
