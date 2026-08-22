import { requestPlatformJson } from "../../../shared/api/http/requestPlatformJson";
import { accountDashboardSchema } from "./accountDashboardSchema";

export const getAccountDashboard = async (signal?: AbortSignal) =>
  await requestPlatformJson({
    path: "/account-dashboard",
    responseSchema: accountDashboardSchema,
    ...(signal === undefined ? {} : { init: { signal } }),
  });
