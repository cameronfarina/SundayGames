import { canonicalPlayerIdentityKey } from "../data/normalizePlayerName.js";
import type { LeagueSeason } from "./leagueSeason.js";
import type { LiveDraftRoomSetup, SaveLiveDraftRoomSetupInput } from "./liveDraftRoomSetups.js";
import type {
  LiveDraftRoomInitialRosterPlayer,
  LiveDraftRoomPlayerCatalogEntry,
} from "./liveDraftRooms.js";
import {
  parseKeeperCommand,
  type KeeperCommandErrorResult,
  type KeeperCommandPreview,
} from "./keeperCommandImport.js";

export type SeasonKeeperSetupErrorCode =
  | "keeper_budget_exceeded"
  | "keeper_player_conflict"
  | "keeper_position_limit"
  | "keeper_roster_full"
  | "keeper_season_mismatch"
  | "keeper_snake_pick_conflict"
  | "keeper_snake_round_invalid"
  | "keeper_team_missing"
  | "keeper_value_invalid";

export class SeasonKeeperSetupError extends Error {
  constructor(
    readonly code: SeasonKeeperSetupErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SeasonKeeperSetupError";
  }
}

export interface SeasonKeeperCommandPreview extends KeeperCommandPreview {
  player: KeeperCommandPreview["player"] & {
    position: LiveDraftRoomPlayerCatalogEntry["position"];
    expectedPrice: number;
  };
}

export type SeasonKeeperCommandResult = SeasonKeeperCommandPreview | KeeperCommandErrorResult;

export interface PreviewSeasonKeeperCommandInput {
  season: LeagueSeason;
  playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[];
  command: string;
}

export interface ApplySeasonKeeperCommandInput {
  season: LeagueSeason;
  setup: LiveDraftRoomSetup | SaveLiveDraftRoomSetupInput;
  preview: SeasonKeeperCommandPreview;
  now?: Date | undefined;
}

const playerIdFor = (player: LiveDraftRoomPlayerCatalogEntry): string =>
  canonicalPlayerIdentityKey(player.name);

const sourceVersionWithKeepers = (sourceVersion: string): string => {
  const base = sourceVersion.replace(/\+keepers-v1$/u, "");

  return `${base}+keepers-v1`;
};

export const previewSeasonKeeperCommand = ({
  season,
  playerCatalog,
  command,
}: PreviewSeasonKeeperCommandInput): SeasonKeeperCommandResult => {
  const result = parseKeeperCommand({
    command,
    draftType: season.settings.draftFormat === "snake" ? "snake" : "auction",
    ...(season.settings.draftFormat === "snake"
      ? { snakeRoundCount: season.settings.snake.rounds }
      : { auctionMinimumBidDollars: season.settings.auction.minimumBidDollars }),
    teams: season.teams.map(team => ({
      teamId: team.id,
      teamName: team.displayName,
      managerNames: [team.ownerDisplayName, ...(team.managerDisplayNames ?? [])],
      aliases: [team.ownerId, team.abbreviation ?? ""].filter(Boolean),
    })),
    players: playerCatalog.map(player => ({
      playerId: playerIdFor(player),
      name: player.name,
    })),
  });
  if (result.kind === "error") return result;

  const player = playerCatalog.find(candidate => playerIdFor(candidate) === result.player.id);
  if (player === undefined) {
    return {
      kind: "error",
      error: {
        code: "unknown_player",
        message: `No player matched "${result.player.name}".`,
        mention: result.player.name,
      },
    };
  }

  return {
    ...result,
    player: {
      ...result.player,
      position: player.position,
      expectedPrice: player.expectedPrice,
    },
  };
};

const existingKeeperTeamName = (
  season: LeagueSeason,
  keeper: LiveDraftRoomInitialRosterPlayer,
): string => season.teams.find(team => team.id === keeper.teamId)?.displayName ?? "another team";

const initialRosterPlayerIdentity = (player: LiveDraftRoomInitialRosterPlayer): string =>
  canonicalPlayerIdentityKey(player.playerName);

const eligiblePositionsForSlot = (
  slot: string,
): readonly LiveDraftRoomPlayerCatalogEntry["position"][] => {
  if (slot === "FLEX" || slot === "RB_WR_TE") return ["RB", "WR", "TE"];
  if (slot === "RB_WR") return ["RB", "WR"];
  if (slot === "WR_TE") return ["WR", "TE"];
  if (slot === "OP" || slot === "SUPERFLEX") return ["QB", "RB", "WR", "TE"];
  if (slot === "BENCH" || slot === "IR") return ["QB", "RB", "WR", "TE", "K", "DST"];
  if (["QB", "RB", "WR", "TE", "K", "DST"].includes(slot)) {
    return [slot as LiveDraftRoomPlayerCatalogEntry["position"]];
  }

  return ["QB", "RB", "WR", "TE", "K", "DST"];
};

const teamRosterFitsConfiguredSlots = (
  season: LeagueSeason,
  players: readonly LiveDraftRoomInitialRosterPlayer[],
): boolean => {
  const lineup = season.settings.roster.lineup as Readonly<Record<string, number>>;
  const slots = Object.entries(lineup).flatMap(([slot, count]) =>
    Number.isInteger(count) && count > 0
      ? Array.from({ length: count }, () => eligiblePositionsForSlot(slot))
      : []
  );
  const missingBenchSlots = season.settings.roster.rosterSize - slots.length;
  if (missingBenchSlots > 0) {
    slots.push(...Array.from(
      { length: missingBenchSlots },
      () => eligiblePositionsForSlot("BENCH"),
    ));
  }

  const playerBySlot = new Array<number>(slots.length).fill(-1);
  const assignPlayer = (playerIndex: number, visitedSlots: Set<number>): boolean => {
    const player = players[playerIndex];
    if (player === undefined) return false;

    for (const [slotIndex, eligiblePositions] of slots.entries()) {
      if (visitedSlots.has(slotIndex) || !eligiblePositions.includes(player.position)) continue;
      visitedSlots.add(slotIndex);
      const assignedPlayerIndex = playerBySlot[slotIndex];
      if (
        assignedPlayerIndex === undefined
        || assignedPlayerIndex === -1
        || assignPlayer(assignedPlayerIndex, visitedSlots)
      ) {
        playerBySlot[slotIndex] = playerIndex;
        return true;
      }
    }

    return false;
  };

  return players.every((_, playerIndex) => assignPlayer(playerIndex, new Set()));
};

const validateResultingInitialRosters = (
  season: LeagueSeason,
  initialRosters: readonly LiveDraftRoomInitialRosterPlayer[],
  preview: SeasonKeeperCommandPreview,
): void => {
  const seenPlayerIdentities = new Set<string>();
  for (const player of initialRosters) {
    if (!season.teams.some(team => team.id === player.teamId)) {
      throw new SeasonKeeperSetupError(
        "keeper_team_missing",
        `Keeper team "${player.teamId}" no longer belongs to this season.`,
      );
    }
    const identity = initialRosterPlayerIdentity(player);
    if (seenPlayerIdentities.has(identity)) {
      throw new SeasonKeeperSetupError(
        "keeper_player_conflict",
        `${player.playerName} is already kept by ${existingKeeperTeamName(season, player)}.`,
      );
    }
    seenPlayerIdentities.add(identity);
  }

  if (season.settings.draftFormat === "snake") {
    const keeperPickKeys = new Set<string>();
    for (const player of initialRosters.filter(candidate => candidate.source === "keeper")) {
      const round = player.keeperRound;
      if (typeof round !== "number" || !Number.isInteger(round) || round <= 0 || round > season.settings.snake.rounds) {
        throw new SeasonKeeperSetupError(
          "keeper_snake_round_invalid",
          `${player.playerName} must use a keeper round between 1 and ${season.settings.snake.rounds}.`,
        );
      }
      const pickKey = `${player.teamId}:${round}`;
      if (keeperPickKeys.has(pickKey)) {
        throw new SeasonKeeperSetupError(
          "keeper_snake_pick_conflict",
          `${existingKeeperTeamName(season, player)} already has a keeper assigned to round ${round}.`,
        );
      }
      keeperPickKeys.add(pickKey);
    }
  }

  for (const team of season.teams) {
    const teamPlayers = initialRosters.filter(player => player.teamId === team.id);
    if (teamPlayers.length > season.settings.roster.rosterSize) {
      throw new SeasonKeeperSetupError(
        "keeper_roster_full",
        `${team.displayName} cannot have more than ${season.settings.roster.rosterSize} keeper${season.settings.roster.rosterSize === 1 ? "" : "s"}.`,
      );
    }

    const positionCounts = new Map<LiveDraftRoomPlayerCatalogEntry["position"], number>();
    for (const player of teamPlayers) {
      const count = (positionCounts.get(player.position) ?? 0) + 1;
      positionCounts.set(player.position, count);
      const maximum = season.settings.roster.rosterMaximums[player.position];
      if (!Number.isInteger(maximum) || count > maximum) {
        throw new SeasonKeeperSetupError(
          "keeper_position_limit",
          `${team.displayName} cannot have more than ${maximum} ${player.position} keeper${maximum === 1 ? "" : "s"}.`,
        );
      }
    }

    if (!teamRosterFitsConfiguredSlots(season, teamPlayers)) {
      const addedPlayerName = team.id === preview.team.id
        ? preview.player.name
        : teamPlayers.at(-1)?.playerName;
      throw new SeasonKeeperSetupError(
        "keeper_position_limit",
        `${team.displayName} has no configured roster slot for ${addedPlayerName ?? "this keeper"}.`,
      );
    }

    if (season.settings.draftFormat === "auction") {
      const minimumBid = season.settings.auction.minimumBidDollars;
      for (const player of teamPlayers) {
        if (!Number.isInteger(player.price) || player.price < minimumBid) {
          throw new SeasonKeeperSetupError(
            "keeper_value_invalid",
            `${player.playerName} must have a whole-dollar keeper cost of at least $${minimumBid}.`,
          );
        }
      }

      const spent = teamPlayers.reduce((total, player) => total + player.price, 0);
      const remainingSlots = season.settings.roster.rosterSize - teamPlayers.length;
      const reservedDollars = remainingSlots * minimumBid;
      if (spent + reservedDollars > season.settings.auction.budgetDollars) {
        const slotLabel = remainingSlots === 1 ? "slot" : "slots";
        const addedPrice = preview.keeper.draftType === "auction"
          ? preview.keeper.auctionCostDollars
          : 0;
        throw new SeasonKeeperSetupError(
          "keeper_budget_exceeded",
          `${team.displayName} cannot keep ${preview.player.name} for $${addedPrice} and reserve $${reservedDollars} for its remaining roster ${slotLabel}.`,
        );
      }
    }
  }
};

export const applySeasonKeeperCommand = ({
  season,
  setup,
  preview,
  now = new Date(),
}: ApplySeasonKeeperCommandInput): SaveLiveDraftRoomSetupInput => {
  if (setup.seasonId !== season.id) {
    throw new SeasonKeeperSetupError(
      "keeper_season_mismatch",
      "Keeper setup does not belong to the selected league season.",
    );
  }
  if (!season.teams.some(team => team.id === preview.team.id)) {
    throw new SeasonKeeperSetupError("keeper_team_missing", "Keeper team no longer belongs to this season.");
  }

  const previewPlayerIdentity = canonicalPlayerIdentityKey(preview.player.name);
  const duplicate = setup.initialRosters.find(player =>
    initialRosterPlayerIdentity(player) === previewPlayerIdentity
      && !(player.source === "keeper" && player.teamId === preview.team.id)
  );
  if (duplicate !== undefined) {
    throw new SeasonKeeperSetupError(
      "keeper_player_conflict",
      `${preview.player.name} is already kept by ${existingKeeperTeamName(season, duplicate)}.`,
    );
  }

  const keeper: LiveDraftRoomInitialRosterPlayer = {
    teamId: preview.team.id,
    playerId: preview.player.id,
    playerName: preview.player.name,
    position: preview.player.position,
    price: preview.keeper.draftType === "auction" ? preview.keeper.auctionCostDollars : 0,
    ...(preview.keeper.draftType === "snake" ? { keeperRound: preview.keeper.keeperRound } : {}),
    expectedPrice: preview.player.expectedPrice,
    source: "keeper",
  };

  const initialRosters = [
    ...setup.initialRosters.filter(player => !(
      player.source === "keeper"
        && player.teamId === preview.team.id
        && initialRosterPlayerIdentity(player) === previewPlayerIdentity
    )),
    keeper,
  ];
  validateResultingInitialRosters(season, initialRosters, preview);

  return {
    seasonId: season.id,
    sourceVersion: sourceVersionWithKeepers(setup.sourceVersion),
    playerCatalog: setup.playerCatalog,
    initialRosters,
    updatedAt: now,
  };
};

export const listSeasonKeepers = (
  setup: Pick<LiveDraftRoomSetup | SaveLiveDraftRoomSetupInput, "initialRosters">,
): readonly LiveDraftRoomInitialRosterPlayer[] =>
  setup.initialRosters.filter(player => player.source === "keeper");

export const removeSeasonKeeper = (
  setup: LiveDraftRoomSetup | SaveLiveDraftRoomSetupInput,
  input: { teamId: string; playerId: string; now?: Date | undefined },
): SaveLiveDraftRoomSetupInput => ({
  seasonId: setup.seasonId,
  sourceVersion: sourceVersionWithKeepers(setup.sourceVersion),
  playerCatalog: setup.playerCatalog,
  initialRosters: setup.initialRosters.filter(player => !(
    player.source === "keeper"
      && player.teamId === input.teamId
      && (player.playerId ?? canonicalPlayerIdentityKey(player.playerName)) === input.playerId
  )),
  updatedAt: input.now ?? new Date(),
});
