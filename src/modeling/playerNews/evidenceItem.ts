import type { PlayerContextEvidence } from "../../../config/playerContext.js";
import { playerNewsAuctionFor } from "./auction.js";
import type { PlayerNewsItem } from "./feedContracts.js";
import { actionForEvidenceImpact, evidenceCategoryFor } from "./impact.js";
import type { PlayerNewsDraftContext } from "./internalContracts.js";
import { playerNewsItemMetadataFor } from "./itemMetadata.js";
import {
  factFromEvidenceNote,
  inferenceFromEvidenceNote,
  normalizedNewsDate,
  playerNewsKeyFor,
  playerNewsSlugFor,
} from "./normalization.js";

export const playerNewsItemFromEvidence = (
  evidence: PlayerContextEvidence,
  index: number,
  draftContext: PlayerNewsDraftContext,
): PlayerNewsItem => {
  const player = evidence.player;
  const impactScore = evidence.adjustedSignal;
  const market = playerNewsAuctionFor(player, draftContext);
  const headlineFact = factFromEvidenceNote(evidence.note);
  const category = evidenceCategoryFor(evidence);
  const sourceDate = normalizedNewsDate(evidence.sourceDate);
  const actionText = `${evidence.category} ${evidence.note ?? ""}`.toLowerCase();

  return {
    id: `local-${playerNewsSlugFor(player)}-${playerNewsSlugFor(evidence.category)}-${index + 1}`,
    providerItemId: `local-evidence-${index + 1}`,
    player,
    normalizedPlayerName: playerNewsKeyFor(player),
    ...playerNewsItemMetadataFor(market),
    category,
    headline: headlineFact ? `${player} ${headlineFact}` : `${player} ${category.toLowerCase()} note.`,
    fantasyImpact: inferenceFromEvidenceNote(evidence.note),
    ...(sourceDate ? { sourceDate } : {}),
    source: {
      provider: evidence.provider ?? "Local evidence",
      ...(evidence.source ? { url: evidence.source } : {}),
      ...(evidence.sourceQuality ? { quality: evidence.sourceQuality } : {}),
    },
    draftAction: actionForEvidenceImpact(impactScore, actionText),
    impactScore,
    auction: market.auction,
    availability: market.availability,
  };
};
