import {
  normalizeSeasonMockConfigurationSnapshot,
  SeasonMockConfigurationSnapshotError,
  type SeasonMockConfigurationSnapshotState,
} from "../seasonMockSnapshot.js";
import type { MockDraftSession } from "./session.js";

export const normalizedSessionConfigurationSnapshot = (
  session: Pick<MockDraftSession, "leagueId" | "seasonId" | "teamId" | "draftMode">,
  value: unknown,
): SeasonMockConfigurationSnapshotState => {
  const snapshot = normalizeSeasonMockConfigurationSnapshot(value);
  if (snapshot.status === "migration-required") return snapshot;
  const { payload } = snapshot;
  if (
    payload.season.leagueId !== session.leagueId
    || payload.season.id !== session.seasonId
    || payload.humanTeamId !== session.teamId
    || payload.season.settings.draftFormat !== session.draftMode.format
  ) {
    throw new SeasonMockConfigurationSnapshotError(
      "snapshot_malformed",
      "Mock draft configuration snapshot is malformed.",
    );
  }
  return snapshot;
};

export const normalizePersistedMockDraftSession = (session: MockDraftSession): MockDraftSession => ({
  ...session,
  configurationSnapshot: normalizedSessionConfigurationSnapshot(
    session,
    session.configurationSnapshot,
  ),
});
