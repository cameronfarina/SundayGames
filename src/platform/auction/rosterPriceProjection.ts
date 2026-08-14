import { analysisCacheFor } from "./analysisCache.js";
import { assignableSlotFor } from "./roster.js";
import type {
  GenericAuctionMockPlayer,
  GenericAuctionMockState,
  GenericAuctionMockTeamReadModel,
} from "./types.js";

export const projectedRosterPricesAfterAcquiring = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockPlayer,
): readonly number[] => {
  const analysis = analysisCacheFor(state);
  const cacheKey = `${team.id}\u0000${player.id}`;
  const cached = analysis.projectedRosterPricesByTeamAndPlayerId.get(cacheKey);
  if (cached !== undefined) return cached;

  const assignedSlot = assignableSlotFor(team, player);
  if (assignedSlot === undefined) return [];

  const openSlots = team.slots
    .filter(slot => slot.playerId === undefined && slot.slot !== assignedSlot.slot)
    .map(slot => ({ ...slot }));
  const positionCounts = {
    ...team.positionCounts,
    [player.position]: (team.positionCounts[player.position] ?? 0) + 1,
  };
  const prices = [player.expectedPrice];
  const candidates = analysis.availablePlayersByExpectedPrice ?? state.board.players
    .filter(candidate => candidate.status === "available")
    .sort((left, right) =>
      right.expectedPrice - left.expectedPrice || left.id.localeCompare(right.id)
    );
  analysis.availablePlayersByExpectedPrice = candidates;

  for (const candidate of candidates) {
    if (prices.length >= team.rosterSlotsRemaining) break;
    if (candidate.id === player.id) continue;
    if ((positionCounts[candidate.position] ?? 0)
      >= (state.configuration.positionMaximums[candidate.position] ?? 0)) continue;
    const slotIndex = openSlots
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => slot.eligiblePositions.includes(candidate.position))
      .sort((left, right) =>
        left.slot.eligiblePositions.length - right.slot.eligiblePositions.length
        || left.slot.slot.localeCompare(right.slot.slot)
      )[0]?.index;
    if (slotIndex === undefined) continue;

    openSlots.splice(slotIndex, 1);
    positionCounts[candidate.position] = (positionCounts[candidate.position] ?? 0) + 1;
    prices.push(candidate.expectedPrice);
  }

  analysis.projectedRosterPricesByTeamAndPlayerId.set(cacheKey, prices);
  return prices;
};
