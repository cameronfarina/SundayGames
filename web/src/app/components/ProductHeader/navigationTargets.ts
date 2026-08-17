import { leaguePath, type LeaguePageName } from "../../../features/league/lib/leaguePaths";
import type { OnboardingLeague } from "../../../shared/api/onboarding/onboardingSchema";

interface NavigationPage {
  readonly label: string;
  readonly legacyPath: string;
  readonly page: LeaguePageName;
}

const everydayPages: readonly NavigationPage[] = [
  { label: "Practice", legacyPath: "/practice", page: "practice" },
  { label: "Player news", legacyPath: "/player-news", page: "player-news" },
  { label: "League", legacyPath: "/league", page: "league" },
  { label: "My team", legacyPath: "/my-team", page: "my-team" },
];

const commissionerPage: NavigationPage = {
  label: "Commissioner",
  legacyPath: "/commissioner",
  page: "commissioner",
};

export interface NavigationTarget {
  readonly label: string;
  readonly page: LeaguePageName;
  readonly to: string;
}

/**
 * The product's primary destinations. The header tabs and the narrow-screen
 * menu both read this, so the two cannot drift apart.
 */
export const navigationTargets = (
  activeLeague: OnboardingLeague | undefined,
  canManageLeague: boolean,
): readonly NavigationTarget[] =>
  [...everydayPages, ...(canManageLeague ? [commissionerPage] : [])].map(page => ({
    label: page.label,
    page: page.page,
    to: activeLeague === undefined ? page.legacyPath : leaguePath(activeLeague, page.page),
  }));
