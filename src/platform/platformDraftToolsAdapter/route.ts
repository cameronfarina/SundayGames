export interface DraftToolsRoute {
  seasonId: string | null;
  targetUrl: string;
}

const validSeasonIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

const seasonIdFrom = (url: URL): string | null => {
  const requestedSeasonIds = url.searchParams.getAll("seasonId");
  if (requestedSeasonIds.length !== 1) return null;

  const seasonId = requestedSeasonIds[0];
  return seasonId !== undefined && validSeasonIdPattern.test(seasonId)
    ? seasonId
    : null;
};

export const draftToolsRouteFor = (requestUrl: string | undefined): DraftToolsRoute | undefined => {
  let url: URL;
  try {
    url = new URL(requestUrl ?? "/", "http://mockd.local");
  } catch {
    return undefined;
  }

  if (!url.pathname.startsWith("/api/")) return undefined;
  return {
    seasonId: seasonIdFrom(url),
    targetUrl: `${url.pathname}${url.search}`,
  };
};
