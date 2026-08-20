import type { OnboardingLeague } from "../../../shared/api/onboarding/onboardingSchema";

export type LeaguePageName =
  | "commissioner"
  | "draft"
  | "league"
  | "mock-drafts"
  | "my-team"
  | "player-news"
  | "practice";

const pageSuffix: Record<LeaguePageName, string> = {
  commissioner: "/commissioner",
  draft: "/draft",
  league: "",
  "mock-drafts": "/mock-drafts",
  "my-team": "/my-team",
  "player-news": "/player-news",
  practice: "/practice",
};

export const leaguePath = (
  league: Pick<OnboardingLeague, "leagueSlug">,
  page: LeaguePageName,
): string => `/leagues/${encodeURIComponent(league.leagueSlug)}${pageSuffix[page]}`;

/** Claiming happens in a section of the league page, not on a route of its own. */
export const claimTeamPath = (
  league: Pick<OnboardingLeague, "leagueSlug">,
): string => `${leaguePath(league, "league")}#claim-your-team`;

export const selectLeagueForRoute = (
  leagues: readonly OnboardingLeague[],
  leagueSlug: string | undefined,
  legacySeasonId: string | null,
): OnboardingLeague | undefined => {
  if (leagueSlug !== undefined) {
    return leagues.find(league => league.leagueSlug === leagueSlug);
  }
  if (legacySeasonId !== null) {
    return leagues.find(league => league.seasonId === legacySeasonId) ?? leagues[0];
  }
  return leagues[0];
};

export const cleanLeagueSearch = (current: URLSearchParams): URLSearchParams => {
  const clean = new URLSearchParams(current);
  clean.delete("seasonId");
  clean.delete("roomId");
  return clean;
};

export const searchForLeagueChange = (current: URLSearchParams): URLSearchParams => {
  const clean = cleanLeagueSearch(current);
  clean.delete("runId");
  clean.delete("sessionId");
  clean.delete("simulationRun");
  return clean;
};

export const leaguePageForPath = (pathname: string): LeaguePageName | undefined => {
  const suffix = pathname.replace(/^\/leagues\/[^/]+/u, "");
  if (suffix === "" || suffix === "/league" || pathname === "/league") return "league";
  if (suffix === "/draft" || pathname === "/draft-room") return "draft";
  if (suffix === "/commissioner" || pathname === "/commissioner") return "commissioner";
  if (suffix === "/mock-drafts" || pathname === "/mock-drafts") return "mock-drafts";
  if (suffix === "/my-team" || pathname === "/my-team") return "my-team";
  if (suffix === "/player-news" || pathname === "/player-news") return "player-news";
  if (suffix === "/practice" || pathname === "/practice") return "practice";
  return undefined;
};

export const leagueSlugForPath = (pathname: string): string | undefined => {
  const encodedSlug = /^\/leagues\/([^/]+)(?:\/|$)/u.exec(pathname)?.[1];
  if (encodedSlug === undefined) return undefined;
  try {
    return decodeURIComponent(encodedSlug);
  } catch {
    return undefined;
  }
};
