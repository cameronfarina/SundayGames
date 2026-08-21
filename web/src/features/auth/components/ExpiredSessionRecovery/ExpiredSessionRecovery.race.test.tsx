import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticationRequiredEvent } from "../../../../shared/api/http/requestPlatformJson";
import { sessionQueryKey } from "../../api/sessionQuery";
import { ExpiredSessionRecovery } from "./ExpiredSessionRecovery";

const deferredResponse = () => {
  let resolveResponse: ((response: Response) => void) | undefined;
  const response = new Promise<Response>((resolve) => { resolveResponse = resolve; });
  return {
    promise: response,
    resolve(value: Response) {
      if (resolveResponse === undefined) throw new Error("Response resolver was not initialized.");
      resolveResponse(value);
    },
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ExpiredSessionRecovery races", () => {
  it("does not let a pending session check clear a newer account", async () => {
    const pendingSessionState = deferredResponse();
    const fetcher = vi.fn(() => pendingSessionState.promise);
    vi.stubGlobal("fetch", fetcher);
    const queryClient = new QueryClient();
    queryClient.setQueryData(sessionQueryKey(), { account: { id: "stale-account" } });
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
    await waitFor(() => { expect(fetcher).toHaveBeenCalledOnce(); });
    queryClient.setQueryData(sessionQueryKey(), { account: { id: "new-account" } });
    await act(async () => {
      pendingSessionState.resolve(new Response(JSON.stringify({ signedIn: false })));
      await pendingSessionState.promise;
    });

    expect(screen.getByRole("heading", { name: "Practice" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/practice");
    expect(queryClient.getQueryData(sessionQueryKey())).toEqual({ account: { id: "new-account" } });
  });

  it("ignores a pending session check after the protected layout unmounts", async () => {
    const pendingSessionState = deferredResponse();
    const fetcher = vi.fn(() => pendingSessionState.promise);
    vi.stubGlobal("fetch", fetcher);
    const queryClient = new QueryClient();
    queryClient.setQueryData(sessionQueryKey(), { account: { id: "stale-account" } });
    const router = createMemoryRouter([
      { element: <ExpiredSessionRecovery />, path: "/practice" },
      { element: <h1>Public page</h1>, path: "/public" },
      { element: <h1>Sign in</h1>, path: "/login" },
    ], { initialEntries: ["/practice"] });

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    act(() => { window.dispatchEvent(new Event(authenticationRequiredEvent)); });
    await waitFor(() => { expect(fetcher).toHaveBeenCalledOnce(); });
    await act(async () => { await router.navigate("/public"); });
    await act(async () => {
      pendingSessionState.resolve(new Response(JSON.stringify({ account: {
        createdAt: "2026-08-13T12:00:00.000Z",
        email: "stale-account@example.com",
        id: "stale-account",
        updatedAt: "2026-08-13T12:00:00.000Z",
      } })));
      await pendingSessionState.promise;
    });

    expect(screen.getByRole("heading", { name: "Public page" })).toBeVisible();
    expect(queryClient.getQueryData(sessionQueryKey())).toEqual({ account: { id: "stale-account" } });
  });

  it("can retry recovery after a protected route change aborts the previous check", async () => {
    const firstSessionState = deferredResponse();
    const secondSessionState = deferredResponse();
    const fetcher = vi.fn()
      .mockReturnValueOnce(firstSessionState.promise)
      .mockReturnValueOnce(secondSessionState.promise);
    vi.stubGlobal("fetch", fetcher);
    const queryClient = new QueryClient();
    queryClient.setQueryData(sessionQueryKey(), { account: { id: "stale-account" } });
    const router = createMemoryRouter([{
      element: <><ExpiredSessionRecovery /><Outlet /></>,
      children: [
        { element: <h1>Practice</h1>, path: "/practice" },
        { element: <h1>Player news</h1>, path: "/player-news" },
      ],
    }], { initialEntries: ["/practice"] });

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    act(() => { window.dispatchEvent(new Event(authenticationRequiredEvent)); });
    await waitFor(() => { expect(fetcher).toHaveBeenCalledOnce(); });
    await act(async () => { await router.navigate("/player-news"); });
    act(() => { window.dispatchEvent(new Event(authenticationRequiredEvent)); });

    await waitFor(() => { expect(fetcher).toHaveBeenCalledTimes(2); });
    expect(screen.getByRole("heading", { name: "Player news" })).toBeVisible();
  });

  it("does not clear the cache when the layout unmounts during query cancellation", async () => {
    let finishCancellation: (() => void) | undefined;
    const cancellation = new Promise<void>((resolve) => { finishCancellation = resolve; });
    const queryClient = new QueryClient();
    const cancelQueries = vi.spyOn(queryClient, "cancelQueries").mockReturnValue(cancellation);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      error: { code: "auth_required", message: "Sign in to continue." },
    }), { status: 401 }))));
    queryClient.setQueryData(sessionQueryKey(), { account: { id: "stale-account" } });
    const router = createMemoryRouter([
      { element: <ExpiredSessionRecovery />, path: "/practice" },
      { element: <h1>Public page</h1>, path: "/public" },
    ], { initialEntries: ["/practice"] });

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    act(() => { window.dispatchEvent(new Event(authenticationRequiredEvent)); });
    await waitFor(() => { expect(cancelQueries).toHaveBeenCalledOnce(); });
    await act(async () => { await router.navigate("/public"); });
    finishCancellation?.();
    await act(async () => { await cancellation; });

    expect(screen.getByRole("heading", { name: "Public page" })).toBeVisible();
    expect(queryClient.getQueryData(sessionQueryKey())).toEqual({ account: { id: "stale-account" } });
  });
});
