export const mockdSessionCookieName = "mockd_session";

export interface MockdSessionCookieOptions {
  path?: string | undefined;
  maxAgeSeconds?: number | undefined;
  expires?: Date | undefined;
  httpOnly?: boolean | undefined;
  secure?: boolean | undefined;
  sameSite?: "Lax" | "Strict" | "None" | undefined;
}

export const mockdSessionCookie = (
  sessionToken: string,
  options: MockdSessionCookieOptions = {},
): string => {
  const cookieParts = [
    `${mockdSessionCookieName}=${encodeURIComponent(sessionToken)}`,
    `Path=${options.path ?? "/"}`,
  ];

  if (options.maxAgeSeconds !== undefined) cookieParts.push(`Max-Age=${options.maxAgeSeconds}`);
  if (options.expires !== undefined) cookieParts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.httpOnly ?? true) cookieParts.push("HttpOnly");
  if (options.secure === true) cookieParts.push("Secure");
  cookieParts.push(`SameSite=${options.sameSite ?? "Lax"}`);

  return cookieParts.join("; ");
};

export const clearMockdSessionCookie = (
  options: Omit<MockdSessionCookieOptions, "maxAgeSeconds" | "expires"> = {},
): string =>
  mockdSessionCookie("", {
    ...options,
    maxAgeSeconds: 0,
    expires: new Date(0),
  });
