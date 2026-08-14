import { canonicalPlayerIdentityKey } from "../data/normalizePlayerName.js";
import {
  replayGenericAuctionMock,
  type GenericAuctionMockCommand,
  type GenericAuctionMockConfig,
  type GenericAuctionMockRosterSlotConfig,
  type GenericAuctionMockState,
} from "./genericAuctionMockEngine.js";
import { analyzeRosterSlots } from "./leagueCreation.js";
import type { LeagueSeason } from "./leagueSeason.js";
import type { LiveDraftRoomSetup } from "./liveDraftRoomSetups.js";
import {
  isProtectedStarterPosition,
  starterEligiblePlayerIdsFor,
} from "./seasonStarterEligibility.js";

export type SeasonAuctionMockErrorCode =
  | "human_team_missing"
  | "invalid_command_log"
  | "setup_mismatch"
  | "wrong_draft_format";

export class SeasonAuctionMockError extends Error {
  constructor(
    readonly code: SeasonAuctionMockErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SeasonAuctionMockError";
  }
}

export interface BuildSeasonAuctionMockConfigInput {
  season: LeagueSeason;
  setup: LiveDraftRoomSetup;
  humanTeamId: string;
  sessionId: string;
  seed: string;
  playerExpectedPrices?: Readonly<Record<string, number>> | undefined;
  playerHumanValues?: Readonly<Record<string, number>> | undefined;
}

const allPositions = ["QB", "RB", "WR", "TE", "K", "DST"] as const;

const rosterSlotsFor = (season: LeagueSeason): readonly GenericAuctionMockRosterSlotConfig[] => {
  const analysis = analyzeRosterSlots(season.settings.roster.lineup);
  const unsupportedSlot = analysis.unsupportedSlots[0];
  if (unsupportedSlot !== undefined) {
    throw new SeasonAuctionMockError(
      "setup_mismatch",
      `Roster slot ${unsupportedSlot} is unsupported. Review the league roster settings before starting a mock.`,
    );
  }

  return analysis.draftableSlots;
};

const positionMaximumsFor = (
  season: LeagueSeason,
  setup: LiveDraftRoomSetup,
): Readonly<Record<string, number>> => {
  const derived = analyzeRosterSlots(season.settings.roster.lineup).rosterMaximums;
  const configured = season.settings.roster.rosterMaximums;
  const positions = new Set([
    ...allPositions,
    ...setup.playerCatalog.map(player => player.position),
  ]);

  return Object.fromEntries([...positions].map(position => {
    const maximum = configured[position];
    const derivedMaximum = derived[position];
    return [
      position,
      typeof maximum === "number" && Number.isInteger(maximum) && maximum >= 0
        ? Math.min(maximum, derivedMaximum)
        : derivedMaximum,
    ];
  }));
};

const invalidCommand = (): never => {
  throw new SeasonAuctionMockError("invalid_command_log", "Auction mock command log is invalid.");
};

const commandFromJson = (value: string): GenericAuctionMockCommand => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return invalidCommand();
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return invalidCommand();
  const record = parsed as Record<string, unknown>;
  if (!Number.isInteger(record.expectedRevision)) return invalidCommand();
  const expectedRevision = Number(record.expectedRevision);
  if (record.type === "start" || record.type === "pass" || record.type === "undo" || record.type === "complete") {
    return { type: record.type, expectedRevision };
  }
  if (record.type === "nominate" && typeof record.playerId === "string" && record.playerId.length > 0) {
    const openingBid = record.openingBid;
    if (openingBid !== undefined && typeof openingBid !== "number") return invalidCommand();
    return {
      type: "nominate",
      expectedRevision,
      playerId: record.playerId,
      ...(openingBid === undefined ? {} : { openingBid }),
    };
  }
  if (record.type === "buy" && typeof record.price === "number") {
    return { type: "buy", expectedRevision, price: record.price };
  }

  return invalidCommand();
};

export const buildSeasonAuctionMockConfig = ({
  season,
  setup,
  humanTeamId,
  sessionId,
  seed,
  playerExpectedPrices = {},
  playerHumanValues = playerExpectedPrices,
}: BuildSeasonAuctionMockConfigInput): GenericAuctionMockConfig => {
  if (season.settings.draftFormat !== "auction") {
    throw new SeasonAuctionMockError("wrong_draft_format", "This mock session is not an auction draft.");
  }
  if (setup.seasonId !== season.id) {
    throw new SeasonAuctionMockError("setup_mismatch", "Auction mock setup does not belong to this season.");
  }
  if (!season.teams.some(team => team.id === humanTeamId)) {
    throw new SeasonAuctionMockError("human_team_missing", "Claim a team before starting an auction mock draft.");
  }

  const rosterSlots = rosterSlotsFor(season);
  const starterEligiblePlayerIds = starterEligiblePlayerIdsFor(setup.playerCatalog);

  return {
    sessionId,
    seed,
    humanTeamId,
    budgetDollars: season.settings.auction.budgetDollars,
    minimumBidDollars: season.settings.auction.minimumBidDollars,
    teams: season.teams.map(team => ({ id: team.id, name: team.displayName })),
    rosterSlots,
    positionMaximums: positionMaximumsFor(season, setup),
    ai: { targetEndingBudgetDollars: 0 },
    players: setup.playerCatalog.map(player => {
      const id = canonicalPlayerIdentityKey(player.name);
      const protectsStarterSlot = isProtectedStarterPosition(player.position);
      const starterEligible = protectsStarterSlot && starterEligiblePlayerIds.has(id);
      return {
        id,
        name: player.name,
        position: player.position,
        expectedPrice: playerExpectedPrices[id] ?? player.expectedPrice,
        humanValue: playerHumanValues[id] ?? playerExpectedPrices[id] ?? player.expectedPrice,
        ...(player.teamAbbreviation === undefined
          ? {}
          : { teamAbbreviation: player.teamAbbreviation }),
        ...(player.byeWeek === undefined ? {} : { byeWeek: player.byeWeek }),
        ...(player.week1Projection === undefined
          ? {}
          : { week1Projection: player.week1Projection }),
        ...(player.weeks1To4Projection === undefined
          ? {}
          : { weeks1To4Projection: player.weeks1To4Projection }),
        ...(player.seasonProjection === undefined
          ? {}
          : { seasonProjection: player.seasonProjection }),
        ...(protectsStarterSlot ? { starterEligible } : {}),
        ...(starterEligible ? { projectedStarter: true } : {}),
      };
    }),
    keepers: setup.initialRosters
      .filter(player => player.source === "keeper")
      .map(player => ({
        teamId: player.teamId,
        playerId: player.playerId ?? canonicalPlayerIdentityKey(player.playerName),
        price: player.price,
      })),
  };
};

export const replaySeasonAuctionMockCommands = (
  config: GenericAuctionMockConfig,
  commandLog: readonly string[],
): GenericAuctionMockState => replayGenericAuctionMock(config, commandLog.map(commandFromJson));
