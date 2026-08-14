import { analyzeRosterSlots } from "../leagueCreation.js";
import { draftFor } from "./draft.js";
import { normalizedString, positiveInteger, requiredObject } from "./json.js";
import { rosterSlotsFor } from "./roster.js";
import { scoringFor } from "./scoring.js";
import { pickOrderFor, teamsFor } from "./teams.js";
import type { EspnLeagueSettingsReviewOutcome } from "./types.js";

export const reviewFor = (
  bodyValue: unknown,
  leagueId: string,
  season: number,
): EspnLeagueSettingsReviewOutcome => {
  const body = requiredObject(bodyValue, "response body");
  const settings = requiredObject(body.settings, "settings");
  const draftSettings = requiredObject(settings.draftSettings, "settings.draftSettings");
  const scoringSettings = requiredObject(settings.scoringSettings, "settings.scoringSettings");
  const rosterSettings = requiredObject(settings.rosterSettings, "settings.rosterSettings");
  const pickOrder = pickOrderFor(draftSettings);
  const teams = teamsFor(body, pickOrder);
  const rosterSlots = rosterSlotsFor(rosterSettings);
  const rosterSlotCount = analyzeRosterSlots(rosterSlots).draftCapacity;
  const draft = draftFor(draftSettings, pickOrder, rosterSlotCount);

  return {
    kind: "review",
    provider: "espn",
    confirmationRequired: true,
    review: {
      externalLeagueId: leagueId,
      season,
      leagueName: normalizedString(settings.name),
      teamCount: positiveInteger(settings.size) ?? teams.length,
      draft: draft.draft,
      scoring: scoringFor(scoringSettings),
      rosterSlots,
      teams,
    },
    warnings: draft.warnings,
  };
};
