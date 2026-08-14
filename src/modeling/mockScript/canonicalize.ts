import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type { MockDraftScript } from "./contracts.js";
import { scriptLabelFor } from "./label.js";

const searchKeyFor = (value: string): string =>
  normalizePlayerName(value).toLowerCase();

const canonicalPlayerNameFor = (player: string, playerNames: readonly string[]): string => {
  const searchKey = searchKeyFor(player);
  const exactMatch = playerNames.find(candidate => searchKeyFor(candidate) === searchKey);
  if (exactMatch) return normalizePlayerName(exactMatch);

  const partialMatches = playerNames.filter(candidate => searchKeyFor(candidate).includes(searchKey));
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
    : { ...script.buildAround, player: canonicalPlayerNameFor(script.buildAround.player, playerNames) };

  return {
    ...script,
    label: scriptLabelFor(targetMaxBids, buildAround),
    ...(buildAround === undefined ? {} : { buildAround }),
    targetMaxBids,
  };
};
