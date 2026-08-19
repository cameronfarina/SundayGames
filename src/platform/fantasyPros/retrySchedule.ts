import type { RecordFantasyProsRefreshOutcomeInput } from "./contracts.js";

/**
 * A failed dataset becomes claimable again after the retry delay rather than
 * after a full cadence, expressed by rewinding the stored timestamp. Both the
 * in-memory and Postgres stores share this so their gating agrees.
 */
export const retryTimestamp = (
  input: Pick<RecordFantasyProsRefreshOutcomeInput, "now" | "error" | "retryDelayMs" | "cadenceMs">,
): string | undefined => {
  if (input.error === undefined) return undefined;
  if (input.retryDelayMs === undefined || input.cadenceMs === undefined) return undefined;
  return new Date(input.now.getTime() - input.cadenceMs + input.retryDelayMs).toISOString();
};
