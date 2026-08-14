import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { authRoutes } from "../../routes/authRoutes";
import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";
import { sessionQueryKey, useSessionQuery } from "../../api/sessionQuery";
import { createProtectedLoader } from "../../routes/protectedLoader";

const account = {
  createdAt: "2026-08-13T12:00:00.000Z",
  email: "cam@example.com",
  id: "account-cam",
  updatedAt: "2026-08-13T12:00:00.000Z",
};
const loginBody = {
  account,
  session: {
    accountId: account.id,
    createdAt: account.createdAt,
    expiresAt: "2026-09-13T12:00:00.000Z",
    id: "session-cam",
  },
  sessionToken: "session-token",
};
const jsonResponse = (body: unknown, status = 200): Response => new Response(
  JSON.stringify(body),
  { headers: { "content-type": "application/json" }, status },
);
const SessionAccount = () => <p>{useSessionQuery().data?.account.email}</p>;
const mountRoute = (path: string) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([
    ...authRoutes,
    { path: "/practice", element: <SessionAccount />, loader: createProtectedLoader(queryClient) },
    { path: "/league", element: <SessionAccount />, loader: createProtectedLoader(queryClient) },
    { path: "/invite", element: <h1>Invitation</h1> },
  ], { initialEntries: [path] });
  render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>);
  return { queryClient, router };
};
const enterCredentials = async () => {
  await userEvent.type(await screen.findByRole("textbox", { name: "Email" }), "cam@example.com");
  await userEvent.type(screen.getByLabelText("Password"), "secure password");
};
afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

describe("AuthForm", () => {
  it("submits login on Enter and redirects only to a safe return path", async () => {
    const fetcher = vi.fn<PlatformFetch>()
      .mockImplementation(() => Promise.resolve(jsonResponse(loginBody)));
    vi.stubGlobal("fetch", fetcher);
    const path = "/login?returnTo=%2Fleague%3FseasonId%3Dseason-1";
    const { queryClient, router: navigation } = mountRoute(path);
    expect(screen.getByLabelText("Password")).toHaveAttribute("minlength", "15");
    await enterCredentials();
    await userEvent.type(screen.getByLabelText("Password"), "{Enter}");
    await waitFor(() => {
      expect(navigation.state.location.pathname).toBe("/league");
    });
    expect(navigation.state.location.search).toBe("?seasonId=season-1");
    expect(screen.getByText("cam@example.com")).toBeVisible();
    expect(queryClient.getQueryData(sessionQueryKey())).toEqual({ account });
    expect(fetcher).toHaveBeenCalledExactlyOnceWith("/sessions", expect.objectContaining({
      method: "POST",
    }));
  });
  it("uses Practice for an unsafe return path and exposes password-change context", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(loginBody)));
    const path = "/login?passwordChanged=1&returnTo=https%3A%2F%2Fevil.example";
    const { router: navigation } = mountRoute(path);
    expect(screen.getByRole("status")).toHaveTextContent("Password changed");
    await enterCredentials();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => {
      expect(navigation.state.location.pathname).toBe("/practice");
    });
  });

  it("keeps server errors visible and offers unverified accounts a recovery path", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      error: {
        code: "email_unverified",
        message: "Verify your email before signing in.",
      },
    }, 403)));
    const { queryClient } = mountRoute("/login?returnTo=%2Finvite%3Ftoken%3Dleague-token");
    await enterCredentials();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Verify your email");
    expect(screen.getByRole("link", { name: "Resend verification" }))
      .toHaveAttribute("href", expect.stringContaining("%2Finvite%3Ftoken%3Dleague-token"));
    expect(queryClient.getQueryData(sessionQueryKey())).toBeUndefined();
  });

  it("caches the auto-login session before protected signup navigation", async () => {
    const fetcher = vi.fn<PlatformFetch>()
      .mockResolvedValueOnce(jsonResponse({ passwordRequired: true }))
      .mockImplementationOnce(async () => {
        await new Promise(resolve => setTimeout(resolve, 25));
        return jsonResponse({ account }, 201);
      })
      .mockImplementation(() => Promise.resolve(jsonResponse(loginBody)));
    vi.stubGlobal("fetch", fetcher);
    const signupPath = "/signup?returnTo=%2Fleague%3FseasonId%3Dseason-1";
    const { queryClient, router: navigation } = mountRoute(signupPath);
    await enterCredentials();
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByRole("button", { name: "Creating account..." })).toBeDisabled();
    await waitFor(() => {
      expect(navigation.state.location.pathname).toBe("/league");
    });
    expect(screen.getByText("cam@example.com")).toBeVisible();
    expect(queryClient.getQueryData(sessionQueryKey())).toEqual({ account });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({
      email: "cam@example.com",
      password: "secure password",
      returnTo: "/league?seasonId=season-1",
    }));
    expect(fetcher).toHaveBeenNthCalledWith(
      3, "/sessions", expect.objectContaining({ method: "POST" }),
    );
  });

  it("collects only email for verification signup and preserves invitation return", async () => {
    const fetcher = vi.fn<PlatformFetch>()
      .mockResolvedValueOnce(jsonResponse({ passwordRequired: false }))
      .mockResolvedValueOnce(jsonResponse({
        accepted: true,
        message: "If this email can be registered, a verification link is on its way.",
      }, 202));
    vi.stubGlobal("fetch", fetcher);
    const { queryClient } = mountRoute("/signup?returnTo=%2Finvite%3Ftoken%3Dleague-token");
    await userEvent.type(await screen.findByRole("textbox", { name: "Email" }), "cam@example.com");
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("status")).toHaveTextContent("verification link");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({
      email: "cam@example.com",
      invitationToken: "league-token",
      returnTo: "/invite?token=league-token",
    }));
    expect(queryClient.getQueryData(sessionQueryKey())).toBeUndefined();
    expect(screen.getByRole("link", { name: "Sign in" }))
      .toHaveAttribute("href", "/login?returnTo=%2Finvite%3Ftoken%3Dleague-token");
  });
});
