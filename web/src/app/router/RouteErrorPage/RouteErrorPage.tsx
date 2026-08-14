import { Link, useRouteError } from "react-router-dom";
import { routeErrorMessage } from "./routeErrorMessage";
import "./RouteErrorPage.css";

export function RouteErrorPage() {
  const error = useRouteError();

  return (
    <main className="route-error">
      <p className="route-error__eyebrow">Something went wrong</p>
      <h1>That page is unavailable</h1>
      <p className="route-error__message" role="alert">{routeErrorMessage(error)}</p>
      <Link className="route-error__link" to="/practice">Return to Practice</Link>
    </main>
  );
}
