export interface PlatformApiErrorInput {
  readonly code: string;
  readonly message: string;
  readonly status: number;
}

export class PlatformApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor({ code, message, status }: PlatformApiErrorInput) {
    super(message);
    this.name = "PlatformApiError";
    this.code = code;
    this.status = status;
  }
}
