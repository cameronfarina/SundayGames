export interface PlatformApiErrorInput {
  readonly body?: unknown;
  readonly code: string;
  readonly message: string;
  readonly status: number;
}

export class PlatformApiError extends Error {
  readonly body: unknown;
  readonly code: string;
  readonly status: number;

  constructor({ body, code, message, status }: PlatformApiErrorInput) {
    super(message);
    this.name = "PlatformApiError";
    this.body = body;
    this.code = code;
    this.status = status;
  }
}
