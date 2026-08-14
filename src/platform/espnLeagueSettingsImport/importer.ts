import { LeagueCreationError } from "../leagueCreation.js";
import { leagueIdFor, requestUrlFor } from "./request.js";
import { reviewFor } from "./review.js";
import type {
  EspnLeagueSettingsHttpTransport,
  EspnLeagueSettingsImportInput,
  EspnLeagueSettingsImportOutcome,
  EspnLeagueSettingsManualReviewOutcome,
} from "./types.js";

const manualReview = (
  input: EspnLeagueSettingsImportInput,
  leagueId: string,
  reason: EspnLeagueSettingsManualReviewOutcome["reason"],
  message: string,
): EspnLeagueSettingsManualReviewOutcome => ({
  kind: "manual-review-required",
  provider: "espn",
  confirmationRequired: true,
  reason,
  externalLeagueId: leagueId,
  season: input.season,
  confirmationMethods: ["screenshot", "manual"],
  message,
});

export const importEspnLeagueSettings = async (
  input: EspnLeagueSettingsImportInput,
  transport: EspnLeagueSettingsHttpTransport,
): Promise<EspnLeagueSettingsImportOutcome> => {
  const leagueId = leagueIdFor(input.leagueIdOrUrl);
  const response = await transport({
    method: "GET",
    url: requestUrlFor(leagueId, input.season),
  });

  if (response.code === 401 || response.code === 403) {
    return manualReview(
      input,
      leagueId,
      "private_or_unauthorized",
      "This ESPN league is private. Confirm its settings from screenshots or enter them manually.",
    );
  }

  try {
    return reviewFor(response.body, leagueId, input.season);
  } catch (error) {
    if (error instanceof LeagueCreationError) {
      return manualReview(input, leagueId, "settings_need_review", error.message);
    }
    throw error;
  }
};
