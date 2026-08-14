import { Buffer } from "node:buffer";
import { MockDraftSessionError, type MockDraftSessionErrorCode } from "./error.js";
import type { MockDraftModeMetadata } from "./metadata.js";
import type { MockDraftSessionResourcePolicy } from "./resourcePolicy.js";
import type { MockDraftCommand, MockDraftSession } from "./session.js";

type RequiredValueErrorCode = Extract<
  MockDraftSessionErrorCode,
  "command_key_required" | "command_required" | "owner_required" | "team_required"
>;

export const requireNonEmpty = (
  value: string,
  code: RequiredValueErrorCode,
  message: string,
): string => {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) throw new MockDraftSessionError(code, message);
  return trimmedValue;
};

export const validateDraftMode = (draftMode: MockDraftModeMetadata): MockDraftModeMetadata => {
  if (!Number.isInteger(draftMode.mockCount) || draftMode.mockCount <= 0) {
    throw new MockDraftSessionError("mock_count_required", "Mock count must be a positive whole number.");
  }
  return {
    ...draftMode,
    ...(draftMode.label === undefined ? {} : { label: draftMode.label.trim() }),
    ...(draftMode.settings === undefined ? {} : { settings: { ...draftMode.settings } }),
  };
};

export const assertWritableForCommand = (session: MockDraftSession): void => {
  if (session.status === "completed" || session.status === "abandoned") {
    throw new MockDraftSessionError(
      "session_not_writable",
      "Completed or abandoned mock draft sessions cannot accept new commands.",
    );
  }
};

export const assertExpectedRevision = (
  session: MockDraftSession,
  expectedRevision: number,
): void => {
  if (expectedRevision !== session.revision) {
    throw new MockDraftSessionError(
      "stale_revision",
      "Mock draft session changed since this action was prepared. Refresh and try again.",
    );
  }
};

export const assertExpectedCommandCount = (
  session: MockDraftSession,
  expectedCommandCount: number,
): void => {
  if (expectedCommandCount !== session.commandLog.length) {
    throw new MockDraftSessionError(
      "stale_command_count",
      `Mock draft session expected ${expectedCommandCount} command(s), but it has ${session.commandLog.length}. Refresh and try again.`,
    );
  }
};

type StoredCommandIdentity = Pick<MockDraftCommand, "id" | "idempotencyKey" | "command">;

const commandBytes = (command: StoredCommandIdentity): number =>
  Buffer.byteLength(command.id, "utf8")
  + Buffer.byteLength(command.idempotencyKey, "utf8")
  + Buffer.byteLength(command.command, "utf8");

export const assertCommandLogCapacity = (
  session: MockDraftSession,
  command: StoredCommandIdentity,
  resourcePolicy: MockDraftSessionResourcePolicy,
): void => {
  if (session.commandLog.length >= resourcePolicy.maxCommandsPerSession) {
    throw new MockDraftSessionError(
      "session_command_count_limit",
      "This mock draft reached its command limit. Finish or reset it before continuing.",
    );
  }
  const storedBytes = session.commandLog.reduce(
    (total, storedCommand) => total + commandBytes(storedCommand),
    0,
  );
  if (storedBytes + commandBytes(command) > resourcePolicy.maxCommandBytesPerSession) {
    throw new MockDraftSessionError(
      "session_command_bytes_limit",
      "This mock draft reached its command storage limit. Finish or reset it before continuing.",
    );
  }
};
