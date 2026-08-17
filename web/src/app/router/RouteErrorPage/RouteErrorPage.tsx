import { useEffect } from "react";
import { Link, useRouteError } from "react-router-dom";
import { reloadPage } from "./reloadPage";
import { routeErrorMessage } from "./routeErrorMessage";
import { isStaleChunkError, reloadOnceForStaleChunk } from "./staleChunkReload";
import "./RouteErrorPage.css";

export function RouteErrorPage() {
  const error = useRouteError();
  const staleChunk = isStaleChunkError(error);

  useEffect(() => {
    if (staleChunk) reloadOnceForStaleChunk(window.sessionStorage, Date.now, reloadPage);
  }, [staleChunk]);

  return (
    <main className="route-error">
      <p className="route-error__eyebrow">Something went wrong</p>
      <h1>That page is unavailable</h1>
      <p className="route-error__message" role="alert">{routeErrorMessage(error)}</p>
      <Link className="route-error__link" to="/practice">Return to Practice</Link>
    </main>
  );
}
