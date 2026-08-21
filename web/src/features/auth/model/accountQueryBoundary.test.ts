import { QueryClient, queryOptions } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { onboardingQueryOptions } from "../../../shared/api/onboarding/onboardingQuery";
import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import type { AuthSession } from "../api/authSchemas";
import { sessionQueryKey } from "../api/sessionQuery";
import {
  resetAccountQueryState,
  resetAccountQueryStateIfUnchanged,
} from "./accountQueryBoundary";

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

describe("resetAccountQueryStateIfUnchanged", () => {
  it("preserves the cache when recovery is already aborted", async () => {
    const client = new QueryClient();
    const accountA = sessionFor("account-a");
    const controller = new AbortController();
    client.setQueryData(sessionQueryKey(), accountA);
    controller.abort();

    await expect(resetAccountQueryStateIfUnchanged(client, accountA, controller.signal))
      .resolves.toBe(false);
    expect(client.getQueryData(sessionQueryKey())).toEqual(accountA);
  });

  it("preserves a newer account installed while queries are cancelling", async () => {
    let finishCancellation: (() => void) | undefined;
    const cancellation = new Promise<void>((resolve) => { finishCancellation = resolve; });
    const client = new QueryClient();
    vi.spyOn(client, "cancelQueries").mockReturnValue(cancellation);
    const accountA = sessionFor("account-a");
    const accountB = sessionFor("account-b");
    const controller = new AbortController();
    client.setQueryData(sessionQueryKey(), accountA);

    const reset = resetAccountQueryStateIfUnchanged(client, accountA, controller.signal);
    client.setQueryData(sessionQueryKey(), accountB);
    finishCancellation?.();

    await expect(reset).resolves.toBe(false);
    expect(client.getQueryData(sessionQueryKey())).toEqual(accountB);
  });

  it("preserves the cache when recovery is aborted while queries are cancelling", async () => {
    let finishCancellation: (() => void) | undefined;
    const cancellation = new Promise<void>((resolve) => { finishCancellation = resolve; });
    const client = new QueryClient();
    vi.spyOn(client, "cancelQueries").mockReturnValue(cancellation);
    const accountA = sessionFor("account-a");
    const controller = new AbortController();
    client.setQueryData(sessionQueryKey(), accountA);

    const reset = resetAccountQueryStateIfUnchanged(client, accountA, controller.signal);
    controller.abort();
    finishCancellation?.();

    await expect(reset).resolves.toBe(false);
    expect(client.getQueryData(sessionQueryKey())).toEqual(accountA);
  });
});
