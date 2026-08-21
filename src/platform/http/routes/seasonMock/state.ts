import type { GenericAuctionMockState } from "../../../genericAuctionMockEngine.js";
import {
  managerDraftProfileReadModel,
  type ManagerDraftProfileSnapshot,
} from "../../../managerDraftProfiles.js";
import type { MockDraftSession } from "../../../mockSessions.js";
import { buildSeasonAuctionMockConfig, replaySeasonAuctionMockCommands } from "../../../seasonAuctionMock.js";
import { buildSeasonMockResults } from "../../../seasonMockResults.js";
import { seasonMockReplayConfiguration } from "../../../seasonMockSnapshot.js";
import { buildSeasonSnakeMockConfig, replaySeasonSnakeMockCommands, SeasonSnakeMockError } from "../../../seasonSnakeMock.js";
import type { SnakeDraftState } from "../../../snakeDraftEngine.js";
import type { SeasonMockDraftContext } from "./context.js";

const snakeStateForSeasonMock = (
  context: SeasonMockDraftContext,
  session: MockDraftSession,
  additionalCommand?: string,
): SnakeDraftState => {
  const config = buildSeasonSnakeMockConfig({
    season: context.season,
    setup: context.setup,
    humanTeamId: context.membership.teamId,
    sessionId: session.id,
    seed: session.id,
  });
  const commandLog = session.commandLog.map(command => command.command);
  return replaySeasonSnakeMockCommands(config, additionalCommand === undefined ? commandLog : [...commandLog, additionalCommand]);
};

const auctionStateForSeasonMock = async (
  context: SeasonMockDraftContext,
  session: MockDraftSession,
  playerExpectedPrices: Readonly<Record<string, number>>,
  playerHumanValues: Readonly<Record<string, number>>,
  managerProfiles: readonly ManagerDraftProfileSnapshot[],
  additionalCommand?: string,
): Promise<GenericAuctionMockState> => {
  const config = buildSeasonAuctionMockConfig({
    season: context.season,
    setup: context.setup,
    humanTeamId: context.membership.teamId,
    sessionId: session.id,
    seed: session.id,
    playerExpectedPrices,
    playerHumanValues,
    managerProfiles,
  });
  const commandLog = session.commandLog.map(command => command.command);
  return replaySeasonAuctionMockCommands(config, additionalCommand === undefined ? commandLog : [...commandLog, additionalCommand]);
};

export const stateForSeasonMock = async (
  context: SeasonMockDraftContext,
  session: MockDraftSession,
  additionalCommand?: string,
): Promise<SnakeDraftState | GenericAuctionMockState> => {
  const snapshot = seasonMockReplayConfiguration(session.configurationSnapshot);
  const replayContext = {
    ...context,
    membership: { ...context.membership, teamId: snapshot.humanTeamId },
    season: snapshot.season,
    setup: snapshot.setup,
  };
  return snapshot.season.settings.draftFormat === "snake"
    ? snakeStateForSeasonMock(replayContext, session, additionalCommand)
    : await auctionStateForSeasonMock(
        replayContext,
        session,
        snapshot.playerExpectedPrices,
        snapshot.playerHumanValues,
        snapshot.managerProfiles,
        additionalCommand,
      );
};

export const seasonMockResponseBody = (
  mockSession: MockDraftSession,
  state: SnakeDraftState | GenericAuctionMockState,
) => {
  const managerProfiles = mockSession.draftMode.format === "auction"
    ? seasonMockReplayConfiguration(mockSession.configurationSnapshot)
      .managerProfiles.map(managerDraftProfileReadModel)
    : undefined;
  return {
    mockSession,
    state,
    ...(managerProfiles === undefined ? {} : { managerProfiles }),
    ...(state.session.status === "completed" ? { results: buildSeasonMockResults(state) } : {}),
  };
};

export const serializedSeasonMockCommand = (value: unknown): string => {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new SeasonSnakeMockError("invalid_command_log", "Snake mock command log is invalid.");
  return serialized;
};
