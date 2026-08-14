import { PlatformJobOrchestratorError } from "./errors.js";
import type { PlatformJobType } from "./platformJobTypes.js";

export const invalidPayloadError = (type: PlatformJobType): PlatformJobOrchestratorError =>
  new PlatformJobOrchestratorError(
    "invalid_payload",
    `Job input for ${type} is missing required fields.`,
  );

export const missingHandlerError = (type: PlatformJobType): PlatformJobOrchestratorError =>
  new PlatformJobOrchestratorError(
    "missing_handler",
    `No platform job handler was registered for ${type}.`,
  );
