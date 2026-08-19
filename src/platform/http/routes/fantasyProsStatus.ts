import { fantasyProsDatasets } from "../../fantasyPros.js";
import { requireRequestAccount } from "../auth/access.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../contracts.js";
import type { ParsedPlatformHttpRequest } from "../request/parsedRequest.js";
import { methodNotAllowed, notFound } from "../responses.js";

export const routeFantasyProsStatus = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  if (request.segments.length !== 1) return notFound();
  if (request.method !== "GET") return methodNotAllowed();
  await requireRequestAccount(app, request);

  const repository = services.fantasyProsRepository;
  const statuses = repository === undefined ? [] : await repository.datasetStatuses();

  return {
    status: 200,
    body: {
      configured: services.fantasyProsConfigured ?? false,
      datasets: fantasyProsDatasets.map(dataset => {
        const status = statuses.find(candidate => candidate.dataset === dataset);
        return {
          name: dataset,
          lastFetchedAt: status?.lastFetchedAt ?? null,
          // A refresh that fetched but stored nothing looks identical to one
          // that never ran unless the outcome is reported alongside it.
          lastSucceededAt: status?.lastSucceededAt ?? null,
          rowCount: status?.rowCount ?? 0,
          requestCount: status?.requestCount ?? 0,
          lastError: status?.lastError ?? null,
        };
      }),
    },
  };
};
