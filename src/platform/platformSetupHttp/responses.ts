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

export const leagueSetupDeletesTeamsBody = (
  teams: readonly { ownerDisplayName: string; displayName: string }[],
): PlatformSetupHttpErrorBody => ({
  error: {
    code: "league_setup_deletes_teams",
    message: [
      "These rows would delete",
      teams.length === 1 ? "a team" : `${String(teams.length)} teams`,
      `and everything saved against ${teams.length === 1 ? "it" : "them"}, including keepers:`,
      teams.map(team => `${team.ownerDisplayName} (${team.displayName})`).join(", ") + ".",
      "Every team must appear exactly once.",
    ].join(" "),
  },
});

export const screenshotReviewRequiredBody: PlatformSetupHttpErrorBody = {
  error: {
    code: "screenshot_review_required",
    message: "Analyze the screenshot before applying league teams.",
  },
};
