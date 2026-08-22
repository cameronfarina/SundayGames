import { PlatformApiError } from "../../../shared/api/http/PlatformApiError";
import { importReviewSchema } from "../api/leagueConnectionsSchema";
import type { LeagueDraftSetup } from "../api/leagueConnectionsSchema";

export interface ImportFailure {
  readonly draftSetup?: LeagueDraftSetup;
  readonly message: string;
  readonly issues: readonly string[];
}

const unknownFailure = "Could not import this league. Try again in a moment.";

/**
 * A refused import usually knows exactly which settings it could not read. Those
 * reasons are already written for a person, so they are shown as they arrive
 * rather than folded into one sentence that names none of them.
 */
export const importFailure = (error: unknown): ImportFailure => {
  if (!(error instanceof PlatformApiError)) {
    return { issues: [], message: error instanceof Error ? error.message : unknownFailure };
  }
  const review = importReviewSchema.safeParse(error.body);
  return {
    ...(review.success && review.data.error.draftSetup !== undefined
      ? { draftSetup: review.data.error.draftSetup }
      : {}),
    issues: review.success ? review.data.error.issues : [],
    message: error.message,
  };
};
