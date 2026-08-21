import { QueryClient, QueryClientProvider, queryOptions } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticationRequiredEvent } from "../../../../shared/api/http/requestPlatformJson";
import { sessionQueryKey } from "../../api/sessionQuery";
import { ExpiredSessionRecovery } from "./ExpiredSessionRecovery";

const privateAccountQuery = queryOptions({
  queryFn: () => Promise.resolve({ private: true }),
  queryKey: ["private-account-data"],
});
const sessionFor = (id: string) => ({
  account: {
    createdAt: "2026-08-13T12:00:00.000Z",
    email: `${id}@example.com`,
    id,
    updatedAt: "2026-08-13T12:00:00.000Z",
  },
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ExpiredSessionRecovery", () => {
  it("clears account data and preserves the requested route when the session is rejected", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(
      new Response(JSON.stringify({
        error: { code: "auth_required", message: "Sign in to continue." },
      }), { status: 401 }),
    )));
    const queryClient = new QueryClient();
    queryClient.setQueryData(sessionQueryKey(), { account: { id: "stale-account" } });
    queryClient.setQueryData(privateAccountQuery.queryKey, { private: true });
    const router = createMemoryRouter([
      {
        element: <ExpiredSessionRecovery />,
        path: "/leagues/:leagueSlug/practice",
      },
      { element: <h1>Sign in</h1>, path: "/login" },
    ], { initialEntries: ["/leagues/sunday-games/practice?strategy=stars#plan"] });

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    act(() => {
      window.dispatchEvent(new Event(authenticationRequiredEvent));
      window.dispatchEvent(new Event(authenticationRequiredEvent));
    });

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search).toBe(
      "?returnTo=%2Fleagues%2Fsunday-games%2Fpractice%3Fstrategy%3Dstars%23plan",
    );
    expect(queryClient.getQueryData(sessionQueryKey())).toBeUndefined();
    expect(queryClient.getQueryData(privateAccountQuery.queryKey)).toBeUndefined();
  });

  it("ignores a delayed authentication failure after a new session signs in", async () => {
    const newSession = sessionFor("new-account");
    const fetcher = vi.fn(() => Promise.resolve(new Response(JSON.stringify(newSession))));
    vi.stubGlobal("fetch", fetcher);
    const queryClient = new QueryClient();
    queryClient.setQueryData(sessionQueryKey(), newSession);
    const router = createMemoryRouter([
      {
        element: <><ExpiredSessionRecovery /><h1>Practice</h1></>,
        path: "/practice",
      },
      { element: <h1>Sign in</h1>, path: "/login" },
    ], { initialEntries: ["/practice"] });

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    act(() => { window.dispatchEvent(new Event(authenticationRequiredEvent)); });

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith("/session", expect.objectContaining({
        method: "GET",
      }));
    });
    expect(screen.getByRole("heading", { name: "Practice" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/practice");
    expect(queryClient.getQueryData(sessionQueryKey())).toEqual(newSession);
  });

  it("purges the cached account when another tab signs in as a different account", async () => {
    const accountB = sessionFor("account-b");
    const fetcher = vi.fn(() => Promise.resolve(new Response(JSON.stringify(accountB))));
    vi.stubGlobal("fetch", fetcher);
    const queryClient = new QueryClient();
    queryClient.setQueryData(sessionQueryKey(), sessionFor("account-a"));
    queryClient.setQueryData(privateAccountQuery.queryKey, { private: true });
    const router = createMemoryRouter([
      { element: <><ExpiredSessionRecovery /><h1>Practice</h1></>, path: "/practice" },
      { element: <h1>Sign in</h1>, path: "/login" },
    ], { initialEntries: ["/practice"] });

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    act(() => { window.dispatchEvent(new Event(authenticationRequiredEvent)); });

    await waitFor(() => {
      expect(queryClient.getQueryData(sessionQueryKey())).toEqual(accountB);
    });
    expect(fetcher).toHaveBeenCalledWith("/session", expect.objectContaining({ method: "GET" }));
    expect(queryClient.getQueryData(privateAccountQuery.queryKey)).toBeUndefined();
    expect(screen.getByRole("heading", { name: "Practice" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/practice");
  });

  it("fails closed when the session check is unavailable and the stale session is unchanged", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network unavailable"))));
    const queryClient = new QueryClient();
    queryClient.setQueryData(sessionQueryKey(), { account: { id: "stale-account" } });
    queryClient.setQueryData(privateAccountQuery.queryKey, { private: true });
    const router = createMemoryRouter([
      { element: <ExpiredSessionRecovery />, path: "/practice" },
      { element: <h1>Sign in</h1>, path: "/login" },
    ], { initialEntries: ["/practice"] });

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    act(() => { window.dispatchEvent(new Event(authenticationRequiredEvent)); });

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeVisible();
    expect(queryClient.getQueryData(sessionQueryKey())).toBeUndefined();
    expect(queryClient.getQueryData(privateAccountQuery.queryKey)).toBeUndefined();
  });

});
