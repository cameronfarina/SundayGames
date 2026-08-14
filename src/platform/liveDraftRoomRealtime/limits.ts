import type { LiveDraftRoomWaitLimitScope } from "./contracts.js";

export const defaultLiveDraftRoomConcurrentWaitersPerAccount = 4;
export const defaultLiveDraftRoomConcurrentWaiters = 200;
export const defaultLiveDraftRoomWaitRetryAfterSeconds = 5;
export const defaultRevisionWaitTimeoutMs = 25_000;

export class LiveDraftRoomWaitLimitError extends Error {
  constructor(
    readonly scope: LiveDraftRoomWaitLimitScope,
    readonly retryAfterSeconds: number,
  ) {
    super(`Live draft event-stream ${scope} connection limit reached.`);
    this.name = "LiveDraftRoomWaitLimitError";
  }
}

export const requirePositiveSafeInteger = (value: number, name: string): number => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer.`);
  }
  return value;
};
