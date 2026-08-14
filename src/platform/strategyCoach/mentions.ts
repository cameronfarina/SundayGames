import type { Position } from "../../../config/league.js";
import { mentionIndexFor } from "./catalog.js";
import { constraintFor, uniqueConstraints } from "./constraints.js";
import type {
  StrategyCoachConstraintIntent,
  StrategyCoachPlayerConstraint,
} from "./contracts.js";
import type { CatalogCandidate, PlayerMention, PricePreference } from "./internalTypes.js";

export const mentionedPlayersIn = (
  text: string,
  candidates: readonly CatalogCandidate[],
  position: Position,
): PlayerMention[] =>
  candidates
    .filter(candidate => candidate.entry.position === position)
    .map(candidate => {
      const mention = mentionIndexFor(candidate, text);
      return mention === undefined
        ? undefined
        : {
          entry: candidate.entry,
          normalizedName: candidate.normalizedName,
          rawMention: mention.raw,
          index: mention.index,
        };
    })
    .filter((mention): mention is PlayerMention => mention !== undefined)
    .sort((left, right) => left.index - right.index);

interface MentionConstraintOptions {
  pricePreference: PricePreference;
  slot?: string;
  promptMaxBidByName?: ReadonlyMap<string, number>;
}

export const constraintsFromMentions = (
  mentions: readonly PlayerMention[],
  intent: StrategyCoachConstraintIntent,
  options: MentionConstraintOptions,
): StrategyCoachPlayerConstraint[] =>
  uniqueConstraints(mentions.map(mention => {
    const promptMaxBid = options.promptMaxBidByName?.get(mention.normalizedName);

    return constraintFor(
      { entry: mention.entry, normalizedName: mention.normalizedName },
      intent,
      mention.rawMention,
      {
        pricePreference: options.pricePreference,
        ...(options.slot === undefined ? {} : { slot: options.slot }),
        ...(promptMaxBid === undefined ? {} : { promptMaxBid }),
      },
    );
  }));
