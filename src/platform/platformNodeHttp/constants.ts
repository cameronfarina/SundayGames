export const defaultPlatformJsonBodyLimitBytes = 1_048_576;
export const defaultPlatformScreenshotImportBodyLimitBytes = 7_100_000;
export const jsonContentType = "application/json; charset=utf-8";
export const htmlContentType = "text/html; charset=utf-8";
export const minimumCompressionBodyBytes = 1_024;
export const dynamicBrotliQuality = 4;
export const dynamicGzipLevel = 6;
export const staticBrotliQuality = 8;

export const appShellPaths = new Set([
  "/", "/app", "/account-settings", "/login", "/signup", "/verify-email", "/forgot-password",
  "/reset-password", "/invite", "/setup", "/league", "/commissioner",
  "/draft-room", "/practice", "/my-team", "/mock-drafts", "/mock-results",
  "/simulations", "/strategy", "/my-expert", "/player-news", "/connections",
]);

const leagueAppShellPath = /^\/leagues\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/(?:commissioner|draft|mock-drafts|my-team|player-news|practice))?$/u;

export const isAppShellPath = (pathname: string): boolean => (
  appShellPaths.has(pathname) || leagueAppShellPath.test(pathname)
);

export const legacyProductRedirects: ReadonlyMap<string, string> = new Map([
  ["/board", "/practice"],
  ["/mock-results", "/mock-drafts"],
  ["/simulations", "/practice"],
  ["/strategy", "/mock-drafts"],
  ["/my-expert", "/my-team"],
  ["/setup", "/commissioner"],
]);

export const observableRouteRoots = new Set([
  ...[...appShellPaths].map(path => path.slice(1)),
  "accounts", "email-verifications", "fantasypros-status", "healthz",
  "historical-imports", "invitations", "jobs", "league-connections", "league-imports",
  "leagues", "live-rooms",
  "mock-sessions", "onboarding", "player-catalog", "password-resets",
  "pricing-snapshots", "readyz", "season-mock-drafts", "season-simulations",
  "practice-shortlist", "seasons", "session", "sessions",
]);

export const observableHttpMethods = new Set([
  "DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT",
]);
