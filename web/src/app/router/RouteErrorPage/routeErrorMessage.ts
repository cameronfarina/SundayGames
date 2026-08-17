import { isRouteErrorResponse } from "react-router-dom";

export const routeErrorMessage = (error: unknown): string => {
  if (isRouteErrorResponse(error) && error.status === 404) return "We couldn't find that page.";
  if (error instanceof Error && error.message.length > 0) return error.message;
  return "Something went wrong on our end.";
};
