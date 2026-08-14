import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { titleForPath } from "../routeMetadata";

export function RouteEffects() {
  const location = useLocation();

  useLayoutEffect(() => {
    document.title = titleForPath(location.pathname);
    const focusTarget = document.querySelector("[data-route-focus]");
    if (focusTarget instanceof HTMLElement) focusTarget.focus();
  }, [location.pathname]);

  return null;
}
