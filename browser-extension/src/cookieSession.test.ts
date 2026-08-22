import { describe, expect, it, vi } from "vitest";
import { readEspnCredentialPair } from "./cookieSession.js";

describe("readEspnCredentialPair", () => {
  it("reads only the two ESPN session cookies by exact name", async () => {
    const get = vi.fn(({ name }: { readonly name: string }) => Promise.resolve({
      value: name === "espn_s2" ? " signed-session " : " {ACCOUNT-ID} ",
    }));

    await expect(readEspnCredentialPair({ get })).resolves.toEqual({
      credentials: { espnS2: "signed-session", swid: "{ACCOUNT-ID}" },
      ok: true,
    });
    expect(get).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenNthCalledWith(1, {
      name: "espn_s2",
      url: "https://fantasy.espn.com/",
    });
    expect(get).toHaveBeenNthCalledWith(2, {
      name: "SWID",
      url: "https://fantasy.espn.com/",
    });
  });

  it.each(["espn_s2", "SWID"])("fails closed when %s is missing", async missingName => {
    const get = vi.fn(({ name }: { readonly name: string }) => Promise.resolve(
      name === missingName ? undefined : { value: "present" },
    ));

    await expect(readEspnCredentialPair({ get })).resolves.toEqual({
      code: "not_signed_in",
      ok: false,
    });
  });
});
