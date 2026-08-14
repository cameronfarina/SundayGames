import { catalogCandidatesFor } from "./catalog.js";
import { uniqueConstraints } from "./constraints.js";
import type {
  StrategyCoachExtractedConstraints,
  StrategyCoachGuardrail,
  StrategyCoachPlayerCatalogEntry,
} from "./contracts.js";
import { extractExplicitTargetMentions } from "./explicitTargets.js";
import { extractHardLocks } from "./hardLocks.js";
import { constraintsFromMentions, mentionedPlayersIn } from "./mentions.js";
import {
  desiredWrCountFrom,
  globalMaxExcludesKeeperFrom,
  globalMaxPriceFrom,
  hasAvoidEliteIntent,
  hasValueIntent,
  rb2WindowFrom,
} from "./promptSignals.js";

interface ExtractedResult {
  constraints: StrategyCoachExtractedConstraints;
  guardrails: StrategyCoachGuardrail[];
}

export const extractConstraints = (
  promptText: string,
  playerCatalog: readonly StrategyCoachPlayerCatalogEntry[],
): ExtractedResult => {
  const candidates = catalogCandidatesFor(playerCatalog);
  const guardrails: StrategyCoachGuardrail[] = [];
  const hardLocks = extractHardLocks(promptText, candidates, guardrails);
  const hardLockNames = new Set(hardLocks.map(lock => lock.normalizedName));
  const rb2Mentions = mentionedPlayersIn(rb2WindowFrom(promptText), candidates, "RB")
    .filter(mention => !hardLockNames.has(mention.normalizedName));
  const rb2Alternatives = constraintsFromMentions(rb2Mentions, "draft", {
    pricePreference: "draft",
    slot: "RB2",
  });
  const explicitTargets = extractExplicitTargetMentions(promptText, candidates, guardrails);
  const explicitTargetNames = new Set(explicitTargets.map(target => target.normalizedName));
  const mentionedWrTargets = constraintsFromMentions(
    mentionedPlayersIn(promptText, candidates, "WR"),
    "target",
    { pricePreference: "target" },
  ).filter(target => !explicitTargetNames.has(target.normalizedName));
  const wrCandidates = uniqueConstraints([...explicitTargets, ...mentionedWrTargets]
    .filter(target => target.position === "WR"));
  const desiredWrCount = desiredWrCountFrom(promptText);
  const globalMaxPrice = globalMaxPriceFrom(promptText);

  return {
    constraints: {
      hardLocks,
      rb2Alternatives,
      wrCandidates,
      ...(desiredWrCount === undefined ? {} : { desiredWrCount }),
      ...(globalMaxPrice === undefined ? {} : { globalMaxPrice }),
      globalMaxExcludesKeeper: globalMaxExcludesKeeperFrom(promptText),
      avoidElite: hasAvoidEliteIntent(promptText),
      valueIntent: hasValueIntent(promptText),
    },
    guardrails,
  };
};
