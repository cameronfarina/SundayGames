import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionQueryKey } from "../../../features/auth/api/sessionQuery";
import { onboardingQueryOptions } from "../../../shared/api/onboarding/onboardingQuery";
import type { Onboarding } from "../../../shared/api/onboarding/onboardingSchema";
import { AccountMenu } from "./AccountMenu";

const cachedOnboarding: Onboarding = {
  account: { email: "example.user@example.com", id: "account-example" },
  leagues: [],
};

const renderMenu = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(sessionQueryKey(), { private: "session" });
  queryClient.setQueryData(onboardingQueryOptions().queryKey, cachedOnboarding);
  const router = createMemoryRouter([
    { path: "/practice", element: <AccountMenu email="example.user@example.com" /> },
    { path: "/login", element: <h1>Sign in</h1> },
  ], { initialEntries: ["/practice"] });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { queryClient, router };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AccountMenu", () => {
  it("shows account identity and closes when the user clicks elsewhere", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("menuitem", { name: "Change password" })).toBeVisible();
    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens password change in a dialog", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Change password" }));

    expect(screen.getByRole("dialog", { name: "Change password" })).toBeVisible();
    expect(screen.getByLabelText("Current password")).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(screen.queryByRole("dialog", { name: "Change password" })).not.toBeInTheDocument();
  });

  it("prevents duplicate sign-out requests while one is pending", async () => {
    const pendingResponse = new Promise<Response>(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pendingResponse));
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
    await user.click(screen.getByRole("button", { name: "Account menu" }));

    expect(screen.getByRole("menuitem", { name: "Signing out..." })).toHaveAttribute("data-disabled");
  });

  it("clears private query state and returns to login after sign out", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ));
    const user = userEvent.setup();
    const { queryClient, router } = renderMenu();

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    await waitFor(() => { expect(router.state.location.pathname).toBe("/login"); });
    expect(queryClient.getQueryData(sessionQueryKey())).toBeUndefined();
    expect(queryClient.getQueryData(onboardingQueryOptions().queryKey)).toBeUndefined();
  });

  it("reports sign-out failures without discarding the current session", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: "server_error", message: "Could not sign out." },
    }), { status: 503 })));
    const user = userEvent.setup();
    const { queryClient, router } = renderMenu();

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not sign out");
    expect(router.state.location.pathname).toBe("/practice");
    expect(queryClient.getQueryData(sessionQueryKey())).toEqual({ private: "session" });
    expect(queryClient.getQueryData(onboardingQueryOptions().queryKey)).toEqual(cachedOnboarding);
  });
});
