import type { SeasonSimulationPreferredPosition } from "../seasonSimulationPreferences.js";
import type { SeasonSimulationTargetConstraint } from "../seasonSimulationTargets.js";
import type {
  ParsedSeasonSimulationStrategy,
  SeasonSimulationPositionCap,
} from "./contracts.js";
import {
  cleanPlayerName,
  extract,
  preferredCount,
  summaryFor,
  unsupportedWarning,
} from "./strategySupport.js";

export const parseSeasonSimulationStrategy = (
  rawInput: string,
): ParsedSeasonSimulationStrategy => {
  let remainder = rawInput;
  const targetCandidates: {
    index: number;
    target: SeasonSimulationTargetConstraint;
  }[] = [];
  const preferredPositions: SeasonSimulationPreferredPosition[] = [];
  const positionCaps: SeasonSimulationPositionCap[] = [];

  const countedPreference = extract(
    remainder,
    /\b(?:target|prioriti[sz]e|draft)?\s*(\d+|one|two|three|four)\s+(?:elite|top|premium)\s+(QB|RB|WR|TE)s?(?:\s*(?:,|and)?\s*(?:for\s+)?(?:no\s+more\s+than|under|(?:at\s+)?(?:a\s+)?max(?:imum)?(?:\s+price)?(?:\s+of)?)\s*\$?(\d+)(?:\s+(?:for\s+)?each)?)?\b/i,
  );
  if (countedPreference !== undefined) {
    const targetCount = preferredCount(countedPreference.match[1] ?? "");
    const position = countedPreference.match[2]?.toUpperCase();
    const maxAuctionPrice = countedPreference.match[3] === undefined
      ? undefined
      : Number(countedPreference.match[3]);
    if (
      targetCount !== undefined
      && (position === "QB" || position === "RB" || position === "WR" || position === "TE")
      && (maxAuctionPrice === undefined
        || (Number.isSafeInteger(maxAuctionPrice) && maxAuctionPrice > 0))
    ) {
      preferredPositions.push({
        position,
        tier: "elite",
        targetCount,
        ...(maxAuctionPrice === undefined ? {} : { maxAuctionPrice }),
      });
      remainder = countedPreference.remainder;
    }
  }

  while (true) {
    const positionCap = extract(
      remainder,
      /\b(?:do\s+not|don't|dont|never)\s+(?:spend|pay)\s+(?:over|more\s+than)\s+\$?(\d+)\s+(?:for|on)\s+(?:(another|any\s+other|other)\s+)?(QB|RB|WR|TE)s?\b/i,
    );
    if (positionCap === undefined) break;
    const maxAuctionPrice = Number(positionCap.match[1]);
    const position = positionCap.match[3]?.toUpperCase();
    if (
      Number.isSafeInteger(maxAuctionPrice)
      && maxAuctionPrice > 0
      && (position === "QB" || position === "RB" || position === "WR" || position === "TE")
    ) {
      positionCaps.push({
        position,
        maxAuctionPrice,
        excludeNamedTargets: positionCap.match[2] !== undefined,
      });
    }
    remainder = positionCap.remainder;
  }

  while (true) {
    const auctionTarget = extract(
      remainder,
      /\b(?:draft|target)\s+([a-z][a-z.'-]*(?:\s+(?!(?:and\s+)?(?:draft|target)\b)[a-z0-9][a-z0-9.'-]*){0,4}?)\s+(?:for\s+)?(no\s+more\s+than|under|(?:at\s+)?(?:a\s+)?max(?:imum)?(?:\s+price)?(?:\s+of)?)\s*\$(\d+)\b/i,
    );
    if (auctionTarget === undefined) break;
    const playerName = cleanPlayerName(auctionTarget.match[1] ?? "");
    const strictMaximum = auctionTarget.match[2]?.toLowerCase() === "under";
    const maxAuctionPrice = Number(auctionTarget.match[3]) - (strictMaximum ? 1 : 0);
    if (playerName.length > 0 && Number.isSafeInteger(maxAuctionPrice) && maxAuctionPrice > 0) {
      targetCandidates.push({
        index: auctionTarget.index,
        target: { playerName, maxAuctionPrice },
      });
    }
    remainder = auctionTarget.remainder;
  }

  while (true) {
    const snakeRoundTarget = extract(
      remainder,
      /\b(?:draft|target)\s+([a-z][a-z.'-]*(?:\s+(?!(?:and\s+)?(?:draft|target)\b)[a-z0-9][a-z0-9.'-]*){0,4}?)\s+(?:by|no\s+later\s+than)\s+round\s+(\d+)\b/i,
    );
    if (snakeRoundTarget === undefined) break;
    const playerName = cleanPlayerName(snakeRoundTarget.match[1] ?? "");
    const maxSnakeRound = Number(snakeRoundTarget.match[2]);
    if (playerName.length > 0 && Number.isSafeInteger(maxSnakeRound) && maxSnakeRound > 0) {
      targetCandidates.push({
        index: snakeRoundTarget.index,
        target: { playerName, maxSnakeRound },
      });
    }
    remainder = snakeRoundTarget.remainder;
  }

  while (true) {
    const snakePickTarget = extract(
      remainder,
      /\b(?:draft|target)\s+([a-z][a-z.'-]*(?:\s+(?!(?:and\s+)?(?:draft|target)\b)[a-z0-9][a-z0-9.'-]*){0,4}?)\s+(?:by|no\s+later\s+than)\s+(?:overall\s+)?pick\s+(\d+)\b/i,
    );
    if (snakePickTarget === undefined) break;
    const playerName = cleanPlayerName(snakePickTarget.match[1] ?? "");
    const maxSnakeOverallPick = Number(snakePickTarget.match[2]);
    if (
      playerName.length > 0
      && Number.isSafeInteger(maxSnakeOverallPick)
      && maxSnakeOverallPick > 0
    ) {
      targetCandidates.push({
        index: snakePickTarget.index,
        target: { playerName, maxSnakeOverallPick },
      });
    }
    remainder = snakePickTarget.remainder;
  }

  const preferredPattern = /\b(?:target|prioriti[sz]e|draft)?\s*(?:an?\s+)?(?:elite|top|premium)\s+(QB|RB|WR|TE)\b/i;
  while (true) {
    const preference = extract(remainder, preferredPattern);
    if (preference === undefined) break;
    const position = preference.match[1]?.toUpperCase();
    if (position === "QB" || position === "RB" || position === "WR" || position === "TE") {
      if (!preferredPositions.some(candidate => candidate.position === position)) {
        preferredPositions.push({ position, tier: "elite" });
      }
    }
    remainder = preference.remainder;
  }

  const pair = extract(
    remainder,
    /\bpair(?:ed)?\s+with\s+([a-z][a-z.'-]*(?:\s+[a-z][a-z.'-]*){0,3})(?=\s+(?:and|for|by)\b|\s*$)/i,
  );
  const pairWithPlayerName = pair === undefined
    ? undefined
    : cleanPlayerName(pair.match[1] ?? "");
  if (pair !== undefined && pairWithPlayerName !== undefined && pairWithPlayerName.length > 0) {
    remainder = pair.remainder;
  }

  while (true) {
    const namedTarget = extract(
      remainder,
      /\b(?:draft|target)\s+([a-z][a-z.'-]*(?:\s+(?!(?:and|to)\b|(?:and\s+)?(?:draft|target)\b)[a-z0-9][a-z0-9.'-]*){0,4}?)(?=\s*(?:(?:[.;,]\s*)(?:(?:draft|target)\b|$)|and\s+(?:draft|target)\b|(?:and|to)\b|$))/i,
    );
    if (namedTarget === undefined) break;
    const playerName = cleanPlayerName(namedTarget.match[1] ?? "");
    if (playerName.length > 0) {
      targetCandidates.push({ index: namedTarget.index, target: { playerName } });
    }
    remainder = namedTarget.remainder;
  }

  const targets = targetCandidates
    .sort((left, right) => left.index - right.index)
    .map(candidate => candidate.target);
  const target = targets[0];
  const warning = unsupportedWarning(remainder);
  return {
    rawInput,
    targets,
    ...(target === undefined ? {} : { target }),
    preferredPositions,
    ...(positionCaps.length === 0 ? {} : { positionCaps }),
    ...(pairWithPlayerName === undefined || pairWithPlayerName.length === 0
      ? {}
      : { pairWithPlayerName }),
    summary: summaryFor(targets, preferredPositions, positionCaps, pairWithPlayerName),
    warnings: warning === undefined ? [] : [warning],
  };
};
