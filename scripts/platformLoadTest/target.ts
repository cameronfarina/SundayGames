export interface PlatformLoadTarget {
  readonly baseUrl: URL;
  readonly remote: boolean;
}

export const platformLoadTargetFor = (
  rawBaseUrl: string,
  allowRemote = false,
): PlatformLoadTarget => {
  const baseUrl = new URL(rawBaseUrl);
  if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
    throw new Error("Platform load-test target must use HTTP or HTTPS.");
  }
  const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
  const remote = !loopbackHosts.has(baseUrl.hostname);
  if (remote && !allowRemote) {
    throw new Error("Refusing to load-test a remote service without --allow-remote.");
  }
  return { baseUrl, remote };
};
