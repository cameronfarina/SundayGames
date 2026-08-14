import { QueryClient, QueryClientProvider, queryOptions } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import { onboardingQueryOptions, useOnboardingQuery } from "../../../shared/api/onboarding/onboardingQuery";
import { AuthForm } from "../components/AuthForm/AuthForm";
import { PasswordChangeForm } from "../components/PasswordChangeForm/PasswordChangeForm";
import { sessionQueryKey, useSessionQuery } from "../api/sessionQuery";
import { createProtectedLoader } from "../routes/protectedLoader";

const accountB = {
  createdAt: "2026-08-13T12:00:00.000Z",
  email: "account-b@example.com",
  id: "account-b",
  updatedAt: "2026-08-13T12:00:00.000Z",
};
const response = (body: unknown): Response => new Response(JSON.stringify(body), {
  headers: { "content-type": "application/json" },
});
const privateAccountQuery = queryOptions({
  queryFn: () => Promise.resolve({ private: "account-a" }),
  queryKey: ["simulation-run", "account-a-run"],
});
const requestPath = (input: RequestInfo | URL): string => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.pathname;
  return new URL(input.url).pathname;
};
const ProtectedAccount = () => {
  const session = useSessionQuery();
  const onboarding = useOnboardingQuery();
  return <p>{session.data?.account.id} {onboarding.data?.account.id}</p>;
};

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("account query boundaries", () => {
  it("purges account A before account B reaches protected content", async () => {
    const fetcher = vi.fn<PlatformFetch>().mockImplementation(input => {
      const path = requestPath(input);
      if (path === "/session/password") return Promise.resolve(response({ ok: true }));
      if (path === "/sessions") return Promise.resolve(response({
        account: accountB,
        session: {
          accountId: accountB.id,
          createdAt: accountB.createdAt,
          expiresAt: "2026-09-13T12:00:00.000Z",
          id: "session-b",
        },
        sessionToken: "session-b-token",
      }));
      return Promise.resolve(response({ account: { email: accountB.email, id: accountB.id }, leagues: [] }));
    });
    vi.stubGlobal("fetch", fetcher);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(sessionQueryKey(), { account: {
      createdAt: accountB.createdAt,
      email: "account-a@example.com",
      id: "account-a",
      updatedAt: accountB.updatedAt,
    } });
    client.setQueryData(onboardingQueryOptions().queryKey, {
      account: { email: "account-a@example.com", id: "account-a" },
      leagues: [],
    });
    client.setQueryData(privateAccountQuery.queryKey, { private: "account-a" });
    const router = createMemoryRouter([
      { path: "/account", element: <PasswordChangeForm /> },
      { path: "/login", element: <AuthForm mode="login" /> },
      {
        path: "/practice",
        element: <ProtectedAccount />,
        loader: createProtectedLoader(client),
      },
    ], { initialEntries: ["/account"] });
    render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>);

    await userEvent.type(screen.getByLabelText("Current password"), "account a password");
    await userEvent.type(screen.getByLabelText("New password"), "replacement password");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "replacement password{Enter}");
    await screen.findByRole("button", { name: "Sign in" });

    expect(client.getQueryData(sessionQueryKey())).toBeUndefined();
    expect(client.getQueryData(onboardingQueryOptions().queryKey)).toBeUndefined();
    expect(client.getQueryData(privateAccountQuery.queryKey)).toBeUndefined();

    await userEvent.type(screen.getByRole("textbox", { name: "Email" }), accountB.email);
    await userEvent.type(screen.getByLabelText("Password"), "account b password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => { expect(router.state.location.pathname).toBe("/practice"); });
    expect(await screen.findByText("account-b account-b")).toBeVisible();
    expect(fetcher.mock.calls.filter(call => requestPath(call[0]) === "/onboarding")).toHaveLength(1);
  });
});
