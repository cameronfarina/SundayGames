/** The status FantasyPros answers with when it is refusing on rate. */
export const fantasyProsThrottleStatus = 429;

/**
 * Carries the HTTP status alongside the message. The status used to exist only
 * inside the message text, so nothing downstream could tell a throttle apart
 * from an outage and every failure was retried on the same schedule.
 */
export class FantasyProsRequestError extends Error {
  readonly status: number;

  constructor(path: string, status: number) {
    super(`FantasyPros request to ${path} failed with ${status}.`);
    this.name = "FantasyProsRequestError";
    this.status = status;
  }
}

export const isFantasyProsThrottled = (error: unknown): boolean =>
  error instanceof FantasyProsRequestError && error.status === fantasyProsThrottleStatus;
