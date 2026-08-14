import { Outlet } from "react-router-dom";
import { RouteEffects } from "../../router/RouteEffects/RouteEffects";

export function PublicLayout() {
  return (
    <>
      <RouteEffects />
      <main data-route-focus id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </>
  );
}
