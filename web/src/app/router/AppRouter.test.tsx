import { QueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionQueryKey } from "../../features/auth/api/sessionQuery";
import { createPracticeFetch } from "../../features/practice/pages/PracticePage/test/createPracticeFetch";
import { AppProviders } from "../providers/AppProviders/AppProviders";
import { createAppQueryClient } from "../query/createAppQueryClient";
import { AppRouter } from "./AppRouter";
import { createAppRoutes } from "./appRoutes";

describe("AppRouter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the Practice workspace through the supplied router", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(sessionQueryKey(), {
      account: {
        createdAt: "2026-08-13T12:00:00.000Z",
        email: "user@example.com",
        id: "account-1",
        updatedAt: "2026-08-13T12:00:00.000Z",
      },
      onboarding: { intent: null, providers: null, stage: "complete" },
    });
    vi.stubGlobal("fetch", createPracticeFetch());
    const router = createMemoryRouter(createAppRoutes(queryClient), { initialEntries: ["/practice"] });

    render(
      <AppProviders queryClient={queryClient}>
        <AppRouter router={router} />
      </AppProviders>,
    );

    expect(await screen.findByRole("heading", { name: "Draft lab" })).toBeVisible();
    expect(screen.getByRole("main")).toBeVisible();
  });

  it("returns a stale signed-in tab to login when a protected request rejects its session", async () => {
    const queryClient = createAppQueryClient();
    queryClient.setQueryData(sessionQueryKey(), {
      account: {
        createdAt: "2026-08-13T12:00:00.000Z",
        email: "stale@example.com",
        id: "stale-account",
        updatedAt: "2026-08-13T12:00:00.000Z",
      },
    });
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      error: { code: "auth_required", message: "Sign in before using this workspace." },
    }), {
      headers: { "content-type": "application/json" },
      status: 401,
    }))));
    const router = createMemoryRouter(createAppRoutes(queryClient), {
      initialEntries: ["/leagues/the-sunday-games/practice"],
    });

    render(
      <AppProviders queryClient={queryClient}>
        <AppRouter router={router} />
      </AppProviders>,
    );

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search).toBe(
      "?returnTo=%2Fleagues%2Fthe-sunday-games%2Fpractice",
    );
    expect(queryClient.getQueryData(sessionQueryKey())).toBeUndefined();
  });
});
