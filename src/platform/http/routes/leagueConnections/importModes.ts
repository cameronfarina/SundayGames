import type { PlatformHttpResponse } from "../../contracts.js";
import { optionalString } from "../../request/values.js";
import { knownError } from "../../responses.js";

export type LeagueImportMode =
  | { mode: "create" }
  | { mode: "overwrite"; seasonId: string };

/**
 * Overwriting a league the owner already manages is destructive enough that it
 * has to be asked for by name, so an absent or unnamed season is a bad request
 * rather than a quiet fall back to creating a second league.
 */
export const importModeFrom = (body: Record<string, unknown>): LeagueImportMode | null => {
  const mode = optionalString(body.mode) ?? "create";
  if (mode === "create") return { mode: "create" };
  if (mode !== "overwrite") return null;
  const seasonId = optionalString(body.seasonId);
  return seasonId === undefined ? null : { mode: "overwrite", seasonId };
};

export const invalidImportMode = (): PlatformHttpResponse => knownError(
  400,
  "invalid_import_mode",
  "Choose whether to create a new league or replace one you already manage.",
);

export const snapshotRequired = (): PlatformHttpResponse => knownError(
  409,
  "snapshot_required",
  "Sync this league before importing it.",
);

export const leagueImportChanged = (): PlatformHttpResponse => knownError(
  409,
  "league_import_changed",
  "This connected league changed while it was imported. Try again.",
);

export const leagueSetupLocked = (): PlatformHttpResponse => knownError(
  409,
  "league_setup_locked",
  "This league has a live draft room. Close it before replacing the league setup.",
);

/**
 * Everything the owner has to settle at the provider before this league can
 * become a Sunday Games league, in the provider's own terms. The list rides
 * inside the error rather than beside it, so the one thing a caller reads to
 * find out what went wrong holds the whole answer.
 */
export const importNeedsReview = (issues: readonly string[]): PlatformHttpResponse => ({
  status: 422,
  body: {
    error: {
      code: "import_needs_review",
      message: "This league needs a few settings sorted out before it can be imported.",
      issues: [...issues],
    },
  },
});
