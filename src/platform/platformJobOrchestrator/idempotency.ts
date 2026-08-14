import type { PlatformJobType } from "./platformJobTypes.js";

export const idempotencyKeyFor = (
  type: PlatformJobType,
  explicitKey: string | undefined,
  defaultParts: readonly (string | number)[],
): string => [type, explicitKey ?? defaultParts.join(":")].join(":");
