import { useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { titleForPath } from "../routeMetadata";

export function RouteEffects() {
  const location = useLocation();
  const previousPathname = useRef<string | null>(null);

  useLayoutEffect(() => {
    document.title = titleForPath(location.pathname);
    const pathnameChanged = previousPathname.current !== location.pathname;
    previousPathname.current = location.pathname;
    if (!pathnameChanged || location.hash !== "") return;

    window.scrollTo({ behavior: "instant", left: 0, top: 0 });
    const focusTarget = document.querySelector("[data-route-focus]");
    if (focusTarget instanceof HTMLElement) focusTarget.focus({ preventScroll: true });
  }, [location.hash, location.pathname]);

  return null;
}
