import { Outlet } from "react-router-dom";
import { LandingFooter } from "../../../features/landing/components/LandingFooter/LandingFooter";
import { LandingHeader } from "../../../features/landing/components/LandingHeader/LandingHeader";
import { RouteEffects } from "../../router/RouteEffects/RouteEffects";
import "./LandingLayout.css";

/**
 * Chrome for the signed-out front door. It carries its own header and footer
 * rather than the product's, because a visitor here has no league to navigate.
 */
export function LandingLayout() {
  return (
    <div className="landing-layout">
      <RouteEffects />
      <LandingHeader />
      <main className="landing-layout__main" data-route-focus id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <LandingFooter />
    </div>
  );
}
