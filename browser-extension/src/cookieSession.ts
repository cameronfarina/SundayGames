export interface CookieLookupApi {
  readonly get: (details: {
    readonly name: string;
    readonly url: string;
  }) => Promise<{ readonly value: string } | undefined>;
}

export type EspnCredentialResult =
  | {
    readonly credentials: { readonly espnS2: string; readonly swid: string };
    readonly ok: true;
  }
  | { readonly code: "not_signed_in" | "read_failed"; readonly ok: false };

const espnFantasyUrl = "https://fantasy.espn.com/";

export const readEspnCredentialPair = async (
  cookies: CookieLookupApi,
): Promise<EspnCredentialResult> => {
  try {
    const [espnS2Cookie, swidCookie] = await Promise.all([
      cookies.get({ name: "espn_s2", url: espnFantasyUrl }),
      cookies.get({ name: "SWID", url: espnFantasyUrl }),
    ]);
    const espnS2 = espnS2Cookie?.value.trim() ?? "";
    const swid = swidCookie?.value.trim() ?? "";
    if (espnS2 === "" || swid === "") return { code: "not_signed_in", ok: false };
    return { credentials: { espnS2, swid }, ok: true };
  } catch {
    return { code: "read_failed", ok: false };
  }
};
