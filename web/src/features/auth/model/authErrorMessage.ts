import { PlatformApiError } from "../../../shared/api/http/PlatformApiError";

export const authErrorMessage = (error: unknown): string => error instanceof PlatformApiError
  ? error.message
  : "Mockd could not complete that request.";
