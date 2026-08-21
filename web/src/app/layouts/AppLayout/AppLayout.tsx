import { Outlet } from "react-router-dom";
import { ExpiredSessionRecovery } from "../../../features/auth/components/ExpiredSessionRecovery/ExpiredSessionRecovery";
import { ProductHeader } from "../../components/ProductHeader/ProductHeader";
import { RouteEffects } from "../../router/RouteEffects/RouteEffects";
import "./AppLayout.css";

export function AppLayout() {
  return (
    <div className="app-layout">
      <ExpiredSessionRecovery />
      <RouteEffects />
      <a className="app-layout__skip-link" href="#main-content">Skip to content</a>
      <ProductHeader />
      <main className="app-layout__main" data-route-focus id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
