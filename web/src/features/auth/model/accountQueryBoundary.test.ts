import { QueryClient, queryOptions } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { onboardingQueryOptions } from "../../../shared/api/onboarding/onboardingQuery";
import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import type { AuthSession } from "../api/authSchemas";
import { sessionQueryKey } from "../api/sessionQuery";
import { resetAccountQueryState } from "./accountQueryBoundary";

const sessionFor = (id: string): AuthSession => ({
  account: {
    createdAt: "2026-08-13T12:00:00.000Z",
    email: `${id}@example.com`,
    id,
    updatedAt: "2026-08-13T12:00:00.000Z",
  },
});
const privateAccountQuery = queryOptions({
  queryFn: () => Promise.resolve({ private: "account-a" }),
  queryKey: ["season", "account-a-season"],
});

describe("resetAccountQueryState", () => {
  it("removes the previous account before installing the next session", async () => {
    const client = new QueryClient();
    const accountA = sessionFor("account-a");
    const accountB = sessionFor("account-b");
    client.setQueryData(sessionQueryKey(), accountA);
    client.setQueryData(privateAccountQuery.queryKey, { private: "account-a" });
    client.setQueryData(onboardingQueryOptions().queryKey, {
      account: { email: accountA.account.email, id: accountA.account.id },
      leagues: [],
    });

    await resetAccountQueryState(client, accountB);

    expect(client.getQueryData(sessionQueryKey())).toEqual(accountB);
    expect(client.getQueryData(privateAccountQuery.queryKey)).toBeUndefined();
    expect(client.getQueryData(onboardingQueryOptions().queryKey)).toBeUndefined();
  });

  it("forces onboarding to load for the next account", async () => {
    const client = new QueryClient();
    const accountB = sessionFor("account-b");
    const fetcher = vi.fn<PlatformFetch>().mockResolvedValue(new Response(JSON.stringify({
      account: { email: accountB.account.email, id: accountB.account.id },
      leagues: [],
    }), { headers: { "content-type": "application/json" } }));
    client.setQueryData(onboardingQueryOptions().queryKey, {
      account: { email: "account-a@example.com", id: "account-a" },
      leagues: [],
    });

    await resetAccountQueryState(client, accountB);
    const onboarding = await client.fetchQuery(onboardingQueryOptions(fetcher));

    expect(fetcher).toHaveBeenCalledOnce();
    expect(onboarding.account.id).toBe("account-b");
  });
});
