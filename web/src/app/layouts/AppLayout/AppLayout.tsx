import { NavLink, Outlet } from "react-router-dom";
import { RouteEffects } from "../../router/RouteEffects/RouteEffects";
import "./AppLayout.css";

const navigationItems = [
  { label: "Practice", path: "/practice" },
  { label: "League", path: "/league" },
  { label: "My team", path: "/my-team" },
];

export function AppLayout() {
  return (
    <div className="app-layout">
      <RouteEffects />
      <a className="app-layout__skip-link" href="#main-content">Skip to content</a>
      <header className="app-layout__header">
        <NavLink className="app-layout__brand" to="/practice">
          Mockd
        </NavLink>
        <nav aria-label="Primary navigation" className="app-layout__navigation">
          {navigationItems.map((item) => (
            <NavLink className="app-layout__link" key={item.path} prefetch="intent" to={item.path}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-layout__main" data-route-focus id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
