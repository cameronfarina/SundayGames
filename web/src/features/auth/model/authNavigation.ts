const defaultReturnPath = "/practice";
const applicationOrigin = "https://mockd.local";

export const safeReturnPath = (candidate: string | null | undefined): string => {
  if (candidate?.startsWith("/") !== true) {
    return defaultReturnPath;
  }
  if (candidate.startsWith("//")) return defaultReturnPath;

  const destination = new URL(candidate, applicationOrigin);
  if (destination.origin !== applicationOrigin) return defaultReturnPath;

  return `${destination.pathname}${destination.search}${destination.hash}`;
};

export const invitationTokenFromReturnTo = (
  candidate: string | null | undefined,
): string | undefined => {
  const returnTo = safeReturnPath(candidate);
  const destination = new URL(returnTo, applicationOrigin);
  if (destination.pathname !== "/invite") return undefined;

  return destination.searchParams.get("token") ?? undefined;
};
