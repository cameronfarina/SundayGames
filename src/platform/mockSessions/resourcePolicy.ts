export interface MockDraftSessionResourcePolicy {
  maxCommandsPerSession: number;
  maxCommandBytesPerSession: number;
  maxActiveSessionsPerUser: number;
  maxActiveSessionsPerUserSeason: number;
  maxCreationsPerWindow: number;
  creationWindowMs: number;
  inactiveSessionTtlMs: number;
  abandonedRetentionMs: number;
  completedRetentionMs: number;
}

const minuteMs = 60_000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;

export const defaultMockDraftSessionResourcePolicy: MockDraftSessionResourcePolicy = {
  maxCommandsPerSession: 512,
  maxCommandBytesPerSession: 256 * 1_024,
  maxActiveSessionsPerUser: 8,
  maxActiveSessionsPerUserSeason: 3,
  maxCreationsPerWindow: 5,
  creationWindowMs: hourMs,
  inactiveSessionTtlMs: 6 * hourMs,
  abandonedRetentionMs: hourMs,
  completedRetentionMs: dayMs,
};
