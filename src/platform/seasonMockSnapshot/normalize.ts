import {
  seasonMockSnapshotSchema,
  seasonMockSnapshotVersion,
} from "./constants.js";
import type {
  SeasonMockConfigurationSnapshotMigrationRequired,
  SeasonMockConfigurationSnapshotPayloadV2,
  SeasonMockConfigurationSnapshotState,
  SeasonMockConfigurationSnapshotV2,
} from "./contracts.js";
import { deepFreeze } from "./deepFreeze.js";
import { expectedPricesValue } from "./decoding/prices.js";
import { managerProfilesValue } from "./decoding/managerProfiles.js";
import {
  dateString,
  nonEmptyString,
  plainRecord,
  positiveInteger,
} from "./decoding/primitives.js";
import { seasonValue } from "./decoding/season.js";
import { setupValue } from "./decoding/setup.js";
import { assertSnapshotSize, malformedSnapshot } from "./errors.js";

const migrationRequired = (
  reason: SeasonMockConfigurationSnapshotMigrationRequired["reason"],
  sourceVersion?: number,
): SeasonMockConfigurationSnapshotMigrationRequired => deepFreeze({
  status: "migration-required",
  schema: seasonMockSnapshotSchema,
  reason,
  ...(sourceVersion === undefined ? {} : { sourceVersion }),
});

const migrationState = (
  record: Record<string, unknown>,
): SeasonMockConfigurationSnapshotMigrationRequired => {
  if (record.reason === "missing-snapshot") return migrationRequired(record.reason);
  if (record.reason === "unsupported-version") {
    return migrationRequired(record.reason, positiveInteger(record.sourceVersion));
  }
  return malformedSnapshot();
};

const snapshotPayload = (
  value: unknown,
): SeasonMockConfigurationSnapshotPayloadV2 => {
  const record = plainRecord(value);
  const payload: SeasonMockConfigurationSnapshotPayloadV2 = {
    season: seasonValue(record.season),
    setup: setupValue(record.setup),
    humanTeamId: nonEmptyString(record.humanTeamId),
    playerExpectedPrices: expectedPricesValue(record.playerExpectedPrices),
    playerHumanValues: record.playerHumanValues === undefined
      ? expectedPricesValue(record.playerExpectedPrices)
      : expectedPricesValue(record.playerHumanValues),
    managerProfiles: managerProfilesValue(record.managerProfiles),
  };
  if (payload.setup.seasonId !== payload.season.id) return malformedSnapshot();
  if (!payload.season.teams.some(team => team.id === payload.humanTeamId)) {
    return malformedSnapshot();
  }
  if (payload.setup.initialRosters.some(player =>
    !payload.season.teams.some(team => team.id === player.teamId)
  )) return malformedSnapshot();
  const profileTeamIds = payload.managerProfiles.map(profile => profile.teamId);
  if (new Set(profileTeamIds).size !== profileTeamIds.length) return malformedSnapshot();
  if (profileTeamIds.some(teamId => !payload.season.teams.some(team => team.id === teamId))) {
    return malformedSnapshot();
  }
  return payload;
};

export const normalizeSeasonMockConfigurationSnapshot = (
  value: unknown,
): SeasonMockConfigurationSnapshotState => {
  if (value === undefined) return migrationRequired("missing-snapshot");
  assertSnapshotSize(value);
  const record = plainRecord(value);
  if (record.schema !== seasonMockSnapshotSchema) return malformedSnapshot();
  if (record.status === "migration-required") return migrationState(record);
  if (record.status !== "ready") return malformedSnapshot();

  const version = positiveInteger(record.version);
  if (version !== seasonMockSnapshotVersion) {
    return migrationRequired("unsupported-version", version);
  }
  const snapshot: SeasonMockConfigurationSnapshotV2 = {
    status: "ready",
    schema: seasonMockSnapshotSchema,
    version: seasonMockSnapshotVersion,
    capturedAt: dateString(record.capturedAt),
    payload: snapshotPayload(record.payload),
  };
  assertSnapshotSize(snapshot);
  return deepFreeze(snapshot);
};
