import { draftExportSlotOrder } from "./constants.js";
import type { DraftExportRosterSlot, DraftExportTeamState } from "./contracts.js";
import { DraftExportError } from "./errors.js";

const slotOrderSet = new Set<string>(draftExportSlotOrder);
const normalizePlayerName = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, " ");
const playerLocationText = (team: DraftExportTeamState, slot: DraftExportRosterSlot): string =>
  `${team.teamName} ${slot.slot}`;

const validateSlot = (slot: DraftExportRosterSlot): void => {
  if (!slotOrderSet.has(slot.slot)) {
    throw new DraftExportError("invalid_slot", `${slot.slot} is not a supported export roster slot.`);
  }
};

const validatePrice = (team: DraftExportTeamState, slot: DraftExportRosterSlot): void => {
  const player = slot.player;
  if (player && (!Number.isFinite(player.price) || player.price < 0)) {
    throw new DraftExportError(
      "invalid_price",
      `${player.name} on ${playerLocationText(team, slot)} has an invalid price.`,
    );
  }
};

export const validateDraftExportState = (teams: readonly DraftExportTeamState[]): void => {
  const seenPlayers = new Map<string, { displayName: string; location: string }>();
  for (const team of teams) {
    for (const slot of team.slots) {
      validateSlot(slot);
      validatePrice(team, slot);
      if (!slot.player) continue;

      const key = normalizePlayerName(slot.player.name);
      if (!key) continue;
      const previous = seenPlayers.get(key);
      if (previous) {
        throw new DraftExportError(
          "duplicate_player",
          `${previous.displayName} appears on both ${previous.location} and ${playerLocationText(team, slot)}.`,
        );
      }
      seenPlayers.set(key, {
        displayName: slot.player.name,
        location: playerLocationText(team, slot),
      });
    }
  }
};
