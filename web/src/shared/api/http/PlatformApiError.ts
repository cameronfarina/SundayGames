/**
 * One reason a response failed its schema, named in terms a reader can act on:
 * which field, and what was wrong with it. Deliberately not zod's own issue
 * type, so the shape a caller reads stays put when the validator changes.
 */
export interface PlatformApiErrorIssue {
  /** Dotted path to the offending field, empty for a fault in the body itself. */
  readonly path: string;
  readonly message: string;
}

export interface PlatformApiErrorInput {
  readonly body?: unknown;
  readonly code: string;
  readonly issues?: readonly PlatformApiErrorIssue[] | undefined;
  readonly message: string;
  readonly status: number;
}

export class PlatformApiError extends Error {
  readonly body: unknown;
  readonly code: string;
  /**
   * Empty unless the response failed its schema. The message this error carries
   * is written for the person reading the screen, so the detail that says which
   * field broke lives here rather than in the sentence they see.
   */
  readonly issues: readonly PlatformApiErrorIssue[];
  readonly status: number;

  constructor({ body, code, issues, message, status }: PlatformApiErrorInput) {
    super(message);
    this.name = "PlatformApiError";
    this.body = body;
    this.code = code;
    this.issues = issues ?? [];
    this.status = status;
  }
}
