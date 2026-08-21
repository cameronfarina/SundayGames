import {
  loadAccountDashboard,
  type AccountDashboardRepository,
} from "../../accountDashboard.js";
import { requireRequestAccount } from "../auth/access.js";
import type { PlatformApp, PlatformHttpResponse } from "../contracts.js";
import type { ParsedPlatformHttpRequest } from "../request/parsedRequest.js";
import { knownError, methodNotAllowed, notFound } from "../responses.js";

export const routeAccountDashboard = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  repository: AccountDashboardRepository | undefined,
): Promise<PlatformHttpResponse> => {
  if (request.segments.length !== 1) return notFound();
  if (request.method !== "GET") return methodNotAllowed();
  if (repository === undefined) {
    return knownError(
      503,
      "account_dashboard_unavailable",
      "The account dashboard is not configured.",
    );
  }
  const account = await requireRequestAccount(app, request);
  return { status: 200, body: await loadAccountDashboard(repository, account.id) };
};
