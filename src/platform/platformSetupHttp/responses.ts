import type { PlatformSetupHttpErrorBody } from "./contracts.js";

export const leagueSetupImportBlockedBody = <TImport>(
  parsedImport: TImport,
): PlatformSetupHttpErrorBody & { import: TImport } => ({
  error: {
    code: "league_setup_import_blocked",
    message: "Resolve league setup import blockers before applying.",
  },
  import: parsedImport,
});

export const seasonRequiredBody: PlatformSetupHttpErrorBody = {
  error: {
    code: "season_required",
    message: "Choose an existing season before applying league setup import rows.",
  },
};

export const leagueSetupLockedBody: PlatformSetupHttpErrorBody = {
  error: {
    code: "league_setup_locked",
    message: "Team assignments cannot be changed after this season's live draft room has been created.",
  },
};

export const screenshotReviewRequiredBody: PlatformSetupHttpErrorBody = {
  error: {
    code: "screenshot_review_required",
    message: "Analyze the screenshot before applying league teams.",
  },
};
