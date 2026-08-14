import { NavLink } from "react-router-dom";

interface ProductNavigationProps {
  readonly canManageLeague: boolean;
  readonly search: string;
}

const navigationItems = [
  { label: "Practice", path: "/practice" },
  { label: "League", path: "/league" },
  { label: "My team", path: "/my-team" },
];

export const ProductNavigation = ({ canManageLeague, search }: ProductNavigationProps) => (
  <nav aria-label="Primary navigation" className="product-header__navigation">
    {navigationItems.map(item => (
      <NavLink
        className="product-header__link"
        key={item.path}
        prefetch="intent"
        to={{ pathname: item.path, search }}
      >
        {item.label}
      </NavLink>
    ))}
    {canManageLeague && (
      <NavLink
        className="product-header__link"
        prefetch="intent"
        to={{ pathname: "/commissioner", search }}
      >
        Commissioner
      </NavLink>
    )}
  </nav>
);
