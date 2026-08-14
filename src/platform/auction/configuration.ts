import type { GenericAuctionMockConfig } from "./types.js";
import { GenericAuctionMockError } from "./errors.js";
import { expandedRosterSlotName, rosterCapacityFor } from "./roster.js";

const isNonBlank = (value: string): boolean => value.trim().length > 0;

const isNonNegativeFinite = (value: number): boolean => Number.isFinite(value) && value >= 0;

const assertNonNegativeMap = (values: Readonly<Record<string, number>>, label: string): void => {
  for (const [key, value] of Object.entries(values)) {
    if (!isNonBlank(key) || !isNonNegativeFinite(value)) {
      throw new GenericAuctionMockError(
        "invalid_config",
        `${label} must use non-blank keys and non-negative finite values.`,
      );
    }
  }
};

export const assertConfiguration = (config: GenericAuctionMockConfig): void => {
  if (!isNonBlank(config.sessionId) || !isNonBlank(config.seed)) {
    throw new GenericAuctionMockError("invalid_config", "Auction session id and seed are required.");
  }

  if (config.teams.length < 4 || config.teams.length > 20) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Auction mocks require between 4 and 20 teams.",
    );
  }

  const teamIds = config.teams.map(team => team.id);
  if (
    new Set(teamIds).size !== teamIds.length
    || config.teams.some(team => !isNonBlank(team.id) || !isNonBlank(team.name))
  ) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Every auction team needs a unique non-blank id and a non-blank name.",
    );
  }

  if (!teamIds.includes(config.humanTeamId)) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Human team id must identify a configured team.",
    );
  }

  if (
    !Number.isInteger(config.minimumBidDollars)
    || config.minimumBidDollars <= 0
    || !Number.isInteger(config.budgetDollars)
    || config.budgetDollars <= 0
  ) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Auction budget and minimum bid must be positive whole-dollar amounts.",
    );
  }

  if (
    config.rosterSlots.length === 0
    || config.rosterSlots.some(slot =>
      !isNonBlank(slot.slot)
      || !Number.isInteger(slot.count)
      || slot.count <= 0
      || slot.eligiblePositions.length === 0
      || slot.eligiblePositions.some(position => !isNonBlank(position))
      || new Set(slot.eligiblePositions).size !== slot.eligiblePositions.length
    )
  ) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Roster slots require a name, positive count, and unique eligible positions.",
    );
  }

  const slotNames = config.rosterSlots.map(slot => slot.slot);
  const expandedSlotNames = config.rosterSlots.flatMap(slot =>
    Array.from({ length: slot.count }, (_, index) => expandedRosterSlotName(slot, index)),
  );
  if (
    new Set(slotNames).size !== slotNames.length
    || new Set(expandedSlotNames).size !== expandedSlotNames.length
  ) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Roster slot names must remain unique after their counts are expanded.",
    );
  }

  const rosterCapacity = rosterCapacityFor(config);
  if (config.budgetDollars < rosterCapacity * config.minimumBidDollars) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Auction budget must reserve the minimum bid for every roster slot.",
    );
  }

  if (Object.keys(config.positionMaximums).length === 0) {
    throw new GenericAuctionMockError("invalid_config", "At least one position maximum is required.");
  }
  for (const [position, maximum] of Object.entries(config.positionMaximums)) {
    if (!isNonBlank(position) || !Number.isInteger(maximum) || maximum < 0) {
      throw new GenericAuctionMockError(
        "invalid_config",
        "Position maximums must be non-negative whole numbers keyed by position.",
      );
    }
  }

  const eligiblePositions = new Set(config.rosterSlots.flatMap(slot => slot.eligiblePositions));
  const playerIds = config.players.map(player => player.id);
  if (
    new Set(playerIds).size !== playerIds.length
    || config.players.some(player =>
      !isNonBlank(player.id)
      || !isNonBlank(player.name)
      || !isNonBlank(player.position)
      || !isNonNegativeFinite(player.expectedPrice)
      || (player.humanValue !== undefined && !isNonNegativeFinite(player.humanValue))
      || (player.week1Projection !== undefined && !isNonNegativeFinite(player.week1Projection))
      || (player.weeks1To4Projection !== undefined
        && !isNonNegativeFinite(player.weeks1To4Projection))
      || (player.seasonProjection !== undefined && !isNonNegativeFinite(player.seasonProjection))
      || (player.starterEligible !== undefined && typeof player.starterEligible !== "boolean")
      || (player.projectedStarter !== undefined && typeof player.projectedStarter !== "boolean")
    )
  ) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Every player needs a unique id, name, position, and non-negative expected price.",
    );
  }

  const configuredPositions = new Set(Object.keys(config.positionMaximums));
  if (
    [...eligiblePositions].some(position => !configuredPositions.has(position))
    || config.players.some(player => !configuredPositions.has(player.position))
  ) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Every roster and player position must have an explicit position maximum.",
    );
  }

  const aiValues = [
    config.ai?.defaultBidMultiplier,
    config.ai?.rosterNeedDollars,
    config.ai?.randomness,
  ].filter((value): value is number => value !== undefined);
  if (aiValues.some(value => !isNonNegativeFinite(value))) {
    throw new GenericAuctionMockError("invalid_config", "AI settings must be non-negative finite numbers.");
  }
  if (
    config.ai?.targetEndingBudgetDollars !== undefined
    && (!Number.isInteger(config.ai.targetEndingBudgetDollars)
      || config.ai.targetEndingBudgetDollars < 0
      || config.ai.targetEndingBudgetDollars >= config.budgetDollars)
  ) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "AI target ending budget must be a non-negative whole-dollar amount below the auction budget.",
    );
  }
  const spendPacingExcludedPlayerIds = config.ai?.spendPacingExcludedPlayerIds ?? [];
  if (
    new Set(spendPacingExcludedPlayerIds).size !== spendPacingExcludedPlayerIds.length
    || spendPacingExcludedPlayerIds.some(playerId => !playerIds.includes(playerId))
  ) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "AI spend-pacing exclusions must reference unique players in the auction catalog.",
    );
  }

  const plannedAcquisitions = config.plannedAcquisitions ?? [];
  const plannedPlayerIds = plannedAcquisitions.map(acquisition => acquisition.playerId);
  if (
    new Set(plannedPlayerIds).size !== plannedPlayerIds.length
    || plannedAcquisitions.some(acquisition =>
      acquisition.teamId !== config.humanTeamId
      || !playerIds.includes(acquisition.playerId)
      || !Number.isInteger(acquisition.price)
      || acquisition.price < config.minimumBidDollars
    )
  ) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Planned acquisitions require unique catalog players, the human team, and valid prices.",
    );
  }

  for (const team of config.teams) {
    const tendency = team.aiTendency;
    if (
      tendency?.bidMultiplier !== undefined
      && !isNonNegativeFinite(tendency.bidMultiplier)
    ) {
      throw new GenericAuctionMockError(
        "invalid_config",
        "AI bid multipliers must be non-negative finite numbers.",
      );
    }
    if (tendency?.randomness !== undefined && !isNonNegativeFinite(tendency.randomness)) {
      throw new GenericAuctionMockError(
        "invalid_config",
        "AI randomness must be a non-negative finite number.",
      );
    }
    if (tendency?.positionBidMultipliers !== undefined) {
      assertNonNegativeMap(tendency.positionBidMultipliers, "AI position bid multipliers");
    }
    if (tendency?.nominationPositionWeights !== undefined) {
      assertNonNegativeMap(tendency.nominationPositionWeights, "AI nomination weights");
    }
  }
};
