import { isRouteErrorResponse } from "react-router-dom";
import { isStaleChunkError } from "./staleChunkReload";

export const routeErrorMessage = (error: unknown): string => {
  if (isStaleChunkError(error)) return "We updated the site while this tab was open. Refresh the page to continue.";
  if (isRouteErrorResponse(error) && error.status === 404) return "We couldn't find that page.";
  if (error instanceof Error && error.message.length > 0) return error.message;
  return "Something went wrong on our end.";
};
