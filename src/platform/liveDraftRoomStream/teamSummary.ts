import type { LiveDraftRoomTeamState } from "../liveDraftRooms.js";
import type { LiveDraftRoomTeamSummary } from "./contracts/readModel.js";

export const teamSummaryFor = (
  team: LiveDraftRoomTeamState,
): LiveDraftRoomTeamSummary => ({
  teamId: team.teamId,
  ownerId: team.ownerId,
  ownerDisplayName: team.ownerDisplayName,
  teamDisplayName: team.teamDisplayName,
  draftOrderPosition: team.draftOrderPosition,
  budgetDollars: team.budgetDollars,
  spent: team.spent,
  budgetRemaining: team.budgetRemaining,
  rosterSlotsRemaining: team.rosterSlotsRemaining,
  maxBid: team.maxBid,
  positionCounts: { ...team.positionCounts },
  roster: team.roster.map(player => ({ ...player })),
  slots: team.slots.map(slot => (
    slot.player === undefined
      ? { slot: slot.slot }
      : { slot: slot.slot, player: { ...slot.player } }
  )),
});
