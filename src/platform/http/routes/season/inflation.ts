import { withManualInflationMultiplier } from "../../../leagueSeason.js";
import {
  maximumManualInflationMultiplier,
  minimumManualInflationMultiplier,
} from "../../../pricingRebuild/constants.js";
import { requireSeasonManager } from "../../auth/access.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { optionalNumber } from "../../request/values.js";
import { knownError, methodNotAllowed } from "../../responses.js";
import { historicalDraftSetupFor } from "./historicalSetup.js";
import {
  currentLeaguePricingModelVersion,
  rebuildPricingAfterKeeperChange,
} from "./pricingOrchestration.js";

const percentScale = 100;
const minimumInflationPercent = minimumManualInflationMultiplier * percentScale;
const maximumInflationPercent = maximumManualInflationMultiplier * percentScale;

// A multiplier only carries two decimal places, which is one whole percent.
const multiplierFromPercent = (percent: number): number =>
  Math.round(percent) / percentScale;

export const routeSeasonInflation = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
  seasonId: string,
): Promise<PlatformHttpResponse> => {
  if (request.method !== "PUT") return methodNotAllowed();
  await requireSeasonManager(app, request, seasonId);
  const season = await app.getLeagueSeason({
    actorSessionToken: request.sessionToken,
    seasonId,
    now: request.now,
  });
  if (season.settings.draftFormat === "snake") {
    return knownError(
      409,
      "inflation_not_available",
      "Inflation only applies to auction leagues.",
    );
  }
  if (await app.hasStartedLiveDraftRoomForSeason(season.id)) {
    return knownError(
      409,
      "inflation_locked",
      "Pricing is locked after the live draft starts.",
    );
  }

  const percent = optionalNumber(request.body.inflationPercent);
  if (
    percent !== undefined
    && (!Number.isFinite(percent)
      || percent < minimumInflationPercent
      || percent > maximumInflationPercent)
  ) {
    return knownError(
      400,
      "inflation_out_of_range",
      `Enter an inflation percentage between ${String(minimumInflationPercent)} and ${String(maximumInflationPercent)}.`,
    );
  }

  const saved = await app.registerLeagueSeason({
    actorSessionToken: request.sessionToken,
    season: {
      ...season,
      settings: withManualInflationMultiplier(
        season.settings,
        percent === undefined ? undefined : multiplierFromPercent(percent),
      ),
    },
    memberships: await app.listLeagueMemberships(season.leagueId),
    membershipWriteMode: "preserve",
    now: request.now,
  });

  // Saving the number is only half the promise. Prices on the board have to
  // move with it, the same way they move when a draft history is imported.
  const setup = await historicalDraftSetupFor(saved, services, request.now ?? new Date());
  const pricing = setup === null ? undefined : await rebuildPricingAfterKeeperChange(
    app,
    request,
    saved,
    setup,
    { modelVersion: currentLeaguePricingModelVersion },
  );
  return {
    status: 200,
    body: { season: saved, ...(pricing === undefined ? {} : { pricing }) },
  };
};
