import { randomBytes } from "node:crypto";
import type { CreateMockDraftSessionInput } from "./inputs.js";
import type { MockDraftSession } from "./session.js";
import { normalizedSessionConfigurationSnapshot } from "./snapshot.js";
import type { MockDraftSessionRepositoryState } from "./state.js";
import { requireNonEmpty, validateDraftMode } from "./validation.js";

const sessionIdBytes = 16;

const createSessionId = (): string =>
  `mock_sess_${randomBytes(sessionIdBytes).toString("base64url")}`;

export const createMockDraftSession = (
  state: MockDraftSessionRepositoryState,
  input: CreateMockDraftSessionInput,
): MockDraftSession => {
  const now = input.now ?? new Date();
  const status = input.status ?? "active";
  const session: MockDraftSession = {
    id: createSessionId(),
    userId: input.userId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    ownerId: requireNonEmpty(input.ownerId, "owner_required", "Owner id is required."),
    teamId: requireNonEmpty(input.teamId, "team_required", "Team id is required."),
    status,
    draftMode: validateDraftMode(input.draftMode),
    configurationSnapshot: normalizedSessionConfigurationSnapshot(
      {
        leagueId: input.leagueId,
        seasonId: input.seasonId,
        teamId: input.teamId,
        draftMode: input.draftMode,
      },
      input.configurationSnapshot,
    ),
    revision: 1,
    commandLog: [],
    latestResultRef: undefined,
    createdAt: now,
    updatedAt: now,
    startedAt: status === "active" ? now : undefined,
    completedAt: undefined,
    abandonedAt: undefined,
  };
  state.sessionsById.set(session.id, session);
  return session;
};
