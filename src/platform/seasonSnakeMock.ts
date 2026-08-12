import { canonicalPlayerIdentityKey } from "../data/normalizePlayerName.js";
import type { LeagueSeason } from "./leagueSeason.js";
import type { LiveDraftRoomSetup } from "./liveDraftRoomSetups.js";
import {
  createSnakeDraftState,
  replaySnakeDraft,
  type SnakeDraftCommand,
  type SnakeDraftConfig,
  type SnakeDraftRosterSlotConfig,
  type SnakeDraftState,
} from "./snakeDraftEngine.js";

export type SeasonSnakeMockErrorCode =
  | "human_team_missing"
  | "invalid_command_log"
  | "keeper_round_missing"
  | "setup_mismatch"
  | "wrong_draft_format";

export class SeasonSnakeMockError extends Error {
  constructor(
    readonly code: SeasonSnakeMockErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SeasonSnakeMockError";
  }
}

export interface BuildSeasonSnakeMockConfigInput {
  season: LeagueSeason;
  setup: LiveDraftRoomSetup;
  humanTeamId: string;
  sessionId: string;
  seed: string;
}

const skillPositions = ["QB", "RB", "WR", "TE"] as const;
const allPositions = ["QB", "RB", "WR", "TE", "K", "DST"] as const;
const eligiblePositionsForSlot = (slot: string): readonly string[] => {
  if (slot === "FLEX" || slot === "RB_WR_TE") return ["RB", "WR", "TE"];
  if (slot === "RB_WR") return ["RB", "WR"];
  if (slot === "WR_TE") return ["WR", "TE"];
  if (slot === "OP" || slot === "SUPERFLEX") return skillPositions;
  if (slot === "BENCH" || slot === "IR") return allPositions;
  if (allPositions.includes(slot as (typeof allPositions)[number])) return [slot];

  return allPositions;
};

const rosterSlotsFor = (season: LeagueSeason): readonly SnakeDraftRosterSlotConfig[] => {
  const configured = Object.entries(season.settings.roster.lineup)
    .flatMap(([slot, count]) => typeof count === "number" && Number.isInteger(count) && count > 0
      ? [{ slot, count, eligiblePositions: eligiblePositionsForSlot(slot) }]
      : []);
  const capacity = configured.reduce((total, slot) => total + slot.count, 0);
  if (capacity >= season.settings.snake.rounds) return configured;

  return [
    ...configured,
    {
      slot: "BENCH",
      count: season.settings.snake.rounds - capacity,
      eligiblePositions: allPositions,
    },
  ];
};

const commandFromJson = (value: string): SnakeDraftCommand => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new SeasonSnakeMockError("invalid_command_log", "Snake mock command log is invalid.");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SeasonSnakeMockError("invalid_command_log", "Snake mock command log is invalid.");
  }
  const record = parsed as Record<string, unknown>;
  if (!Number.isInteger(record.expectedRevision)) {
    throw new SeasonSnakeMockError("invalid_command_log", "Snake mock command log is invalid.");
  }
  if (record.type === "start" || record.type === "undo" || record.type === "complete") {
    return { type: record.type, expectedRevision: Number(record.expectedRevision) };
  }
  if (record.type === "pick" && typeof record.playerId === "string" && record.playerId.length > 0) {
    return { type: "pick", expectedRevision: Number(record.expectedRevision), playerId: record.playerId };
  }

  throw new SeasonSnakeMockError("invalid_command_log", "Snake mock command log is invalid.");
};

export const buildSeasonSnakeMockConfig = ({
  season,
  setup,
  humanTeamId,
  sessionId,
  seed,
}: BuildSeasonSnakeMockConfigInput): SnakeDraftConfig => {
  if (season.settings.draftFormat !== "snake") {
    throw new SeasonSnakeMockError("wrong_draft_format", "This mock session is not a snake draft.");
  }
  if (setup.seasonId !== season.id) {
    throw new SeasonSnakeMockError("setup_mismatch", "Snake mock setup does not belong to this season.");
  }
  if (!season.teams.some(team => team.id === humanTeamId)) {
    throw new SeasonSnakeMockError("human_team_missing", "Claim a team before starting a snake mock draft.");
  }

  const baseConfig: SnakeDraftConfig = {
    sessionId,
    seed,
    rounds: season.settings.snake.rounds,
    orderType: season.settings.snake.reversal === "third-round" ? "third_round_reversal" : "standard",
    teamOrder: season.settings.snake.order,
    humanTeamId,
    teams: season.teams.map(team => ({ id: team.id, name: team.displayName })),
    rosterSlots: rosterSlotsFor(season),
    players: setup.playerCatalog.map((player, index) => ({
      id: canonicalPlayerIdentityKey(player.name),
      name: player.name,
      position: player.position,
      rank: index + 1,
      adp: index + 1,
      leagueExpectedPick: index + 1,
      ...(player.teamAbbreviation === undefined
        ? {}
        : { teamAbbreviation: player.teamAbbreviation }),
      ...(player.byeWeek === undefined ? {} : { byeWeek: player.byeWeek }),
      ...(player.week1Projection === undefined
        ? {}
        : { week1Projection: player.week1Projection }),
    })),
  };
  const scheduledPicks = createSnakeDraftState(baseConfig).board.picks;
  const keepers = setup.initialRosters
    .filter(player => player.source === "keeper")
    .map(keeper => {
      const keeperRound = keeper.keeperRound;
      if (keeperRound === undefined || !Number.isInteger(keeperRound) || keeperRound <= 0) {
        throw new SeasonSnakeMockError(
          "keeper_round_missing",
          `${keeper.playerName} needs a keeper round before starting this snake mock.`,
        );
      }
      const pick = scheduledPicks.find(candidate =>
        candidate.round === keeperRound && candidate.teamId === keeper.teamId
      );
      if (pick === undefined) {
        throw new SeasonSnakeMockError(
          "keeper_round_missing",
          `${keeper.playerName} does not have a valid keeper pick in round ${keeperRound}.`,
        );
      }

      return {
        teamId: keeper.teamId,
        playerId: keeper.playerId ?? canonicalPlayerIdentityKey(keeper.playerName),
        round: keeperRound,
        pickInRound: pick.pickInRound,
      };
    });

  return { ...baseConfig, keepers };
};

export const replaySeasonSnakeMockCommands = (
  config: SnakeDraftConfig,
  commandLog: readonly string[],
): SnakeDraftState => replaySnakeDraft(config, commandLog.map(commandFromJson));
