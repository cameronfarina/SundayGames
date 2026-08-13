export const sameOriginAuthenticationReturnPath = (
  requestedPath: string | null | undefined,
  origin: string,
): string | undefined => {
  if (requestedPath === null || requestedPath === undefined || !requestedPath.startsWith("/")) {
    return undefined;
  }
  if (requestedPath.includes("\\") || requestedPath.startsWith("//")) return undefined;
  const queryIndex = requestedPath.search(/[?#]/);
  const encodedPathname = queryIndex === -1 ? requestedPath : requestedPath.slice(0, queryIndex);
  if (/%(?:25)*(?:2f|5c)/i.test(encodedPathname)) return undefined;

  try {
    const trustedOrigin = new URL(origin).origin;
    const destination = new URL(requestedPath, trustedOrigin);
    if (destination.origin !== trustedOrigin) return undefined;
    return destination.pathname + destination.search + destination.hash;
  } catch {
    return undefined;
  }
};
