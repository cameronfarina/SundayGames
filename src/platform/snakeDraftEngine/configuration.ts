import type { SnakeDraftConfig } from "./config.js";
import { SnakeDraftError } from "./error.js";
import { expandedRosterSlotName } from "./rosterSlots.js";

export const assertConfiguration = (config: SnakeDraftConfig): void => {
  if (config.teams.length < 4 || config.teams.length > 20) {
    throw new SnakeDraftError("invalid_config", "Snake drafts require between 4 and 20 teams.");
  }

  const teamIds = config.teams.map(team => team.id);
  const uniqueTeamIds = new Set(teamIds);
  if (uniqueTeamIds.size !== teamIds.length) {
    throw new SnakeDraftError("invalid_config", "Every snake draft team must have a unique id.");
  }

  const uniqueOrderedTeamIds = new Set(config.teamOrder);
  if (
    config.teamOrder.length !== config.teams.length
    || uniqueOrderedTeamIds.size !== config.teamOrder.length
    || config.teamOrder.some(teamId => !uniqueTeamIds.has(teamId))
  ) {
    throw new SnakeDraftError("invalid_config", "Team order must include every team exactly once.");
  }

  if (!uniqueTeamIds.has(config.humanTeamId)) {
    throw new SnakeDraftError("invalid_config", "Human team id must identify a configured team.");
  }
  if (!Number.isInteger(config.rounds) || config.rounds <= 0) {
    throw new SnakeDraftError("invalid_config", "Rounds must be a positive whole number.");
  }
  if (config.rosterSlots.length === 0 || config.rosterSlots.some(slot =>
    slot.slot.trim().length === 0
    || !Number.isInteger(slot.count)
    || slot.count <= 0
    || slot.eligiblePositions.length === 0
  )) {
    throw new SnakeDraftError(
      "invalid_config",
      "Roster slots require a name, positive count, and at least one eligible position.",
    );
  }

  const rosterSlotNames = config.rosterSlots.map(slot => slot.slot);
  if (new Set(rosterSlotNames).size !== rosterSlotNames.length) {
    throw new SnakeDraftError("invalid_config", "Every roster slot type must have a unique name.");
  }
  const expandedNames = config.rosterSlots.flatMap(slot =>
    Array.from({ length: slot.count }, (_, index) => expandedRosterSlotName(slot, index)),
  );
  if (new Set(expandedNames).size !== expandedNames.length) {
    throw new SnakeDraftError("invalid_config", "Expanded roster slots must have unique names.");
  }

  const rosterCapacity = config.rosterSlots.reduce((total, slot) => total + slot.count, 0);
  if (config.rounds > rosterCapacity) {
    throw new SnakeDraftError("invalid_config", "Rounds cannot exceed each team's roster capacity.");
  }
  const playerIds = config.players.map(player => player.id);
  if (new Set(playerIds).size !== playerIds.length) {
    throw new SnakeDraftError("invalid_config", "Every player must have a unique id.");
  }
  if (config.players.length < config.teams.length * config.rounds) {
    throw new SnakeDraftError("invalid_config", "The player pool cannot fill every scheduled pick.");
  }
};
