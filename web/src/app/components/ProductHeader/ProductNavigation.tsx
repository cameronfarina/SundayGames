import { NavLink } from "react-router-dom";
import type { OnboardingLeague } from "../../../shared/api/onboarding/onboardingSchema";
import { navigationTargets } from "./navigationTargets";

interface ProductNavigationProps {
  readonly activeLeague: OnboardingLeague | undefined;
  readonly canManageLeague: boolean;
}

export const ProductNavigation = ({ activeLeague, canManageLeague }: ProductNavigationProps) => (
  <nav aria-label="Primary navigation" className="product-header__navigation">
    {navigationTargets(activeLeague, canManageLeague).map(target => (
      <NavLink
        className="product-header__link"
        end={target.page !== "commissioner"}
        key={target.page}
        prefetch="intent"
        to={target.to}
      >
        {target.label}
      </NavLink>
    ))}
  </nav>
);
