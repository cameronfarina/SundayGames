import { useEffect } from "react";
import { Link, useRouteError } from "react-router-dom";
import { reloadPage } from "./reloadPage";
import { routeErrorMessage } from "./routeErrorMessage";
import {
  isStaleChunkError,
  reloadOnceForStaleChunk,
  staleChunkReloadSignature,
} from "./staleChunkReload";
import "./RouteErrorPage.css";

const applicationAssetIdentity = (): string => (
  document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src
  ?? "unknown-application-build"
);

export function RouteErrorPage() {
  const error = useRouteError();
  const staleChunkError = isStaleChunkError(error) ? error : undefined;

  useEffect(() => {
    if (staleChunkError !== undefined) {
      const failureSignature = staleChunkReloadSignature(
        staleChunkError,
        applicationAssetIdentity(),
      );
      reloadOnceForStaleChunk(failureSignature, window.sessionStorage, reloadPage);
    }
  }, [staleChunkError]);

  return (
    <main className="route-error">
      <p className="route-error__eyebrow">Something went wrong</p>
      <h1>That page is unavailable</h1>
      <p className="route-error__message" role="alert">{routeErrorMessage(error)}</p>
      <Link className="route-error__link" to="/practice">Return to Practice</Link>
    </main>
  );
}
