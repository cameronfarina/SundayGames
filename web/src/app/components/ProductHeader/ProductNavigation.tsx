import { NavLink } from "react-router-dom";
import type { OnboardingLeague } from "../../../shared/api/onboarding/onboardingSchema";
import { leaguePath, type LeaguePageName } from "../../../features/league/lib/leaguePaths";

interface ProductNavigationProps {
  readonly activeLeague: OnboardingLeague | undefined;
  readonly canManageLeague: boolean;
}

const navigationItems: readonly { label: string; legacyPath: string; page: LeaguePageName }[] = [
  { label: "Practice", legacyPath: "/practice", page: "practice" },
  { label: "Player news", legacyPath: "/player-news", page: "player-news" },
  { label: "League", legacyPath: "/league", page: "league" },
  { label: "My team", legacyPath: "/my-team", page: "my-team" },
];

export const ProductNavigation = ({ activeLeague, canManageLeague }: ProductNavigationProps) => (
  <nav aria-label="Primary navigation" className="product-header__navigation">
    {navigationItems.map(item => (
      <NavLink
        className="product-header__link"
        end
        key={item.page}
        prefetch="intent"
        to={activeLeague === undefined ? item.legacyPath : leaguePath(activeLeague, item.page)}
      >
        {item.label}
      </NavLink>
    ))}
    {canManageLeague && (
      <NavLink
        className="product-header__link"
        prefetch="intent"
        to={activeLeague === undefined ? "/commissioner" : leaguePath(activeLeague, "commissioner")}
      >
        Commissioner
      </NavLink>
    )}
  </nav>
);
