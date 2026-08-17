import { Outlet } from "react-router-dom";
import { RouteEffects } from "../../router/RouteEffects/RouteEffects";
import "./PublicLayout.css";

export function PublicLayout() {
  return (
    <>
      <RouteEffects />
      <main className="public-layout__main" data-route-focus id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </>
  );
}
