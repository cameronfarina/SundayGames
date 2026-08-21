import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthAccount } from "../../../auth/api/authSchemas";
import { sessionQueryKey } from "../../../auth/api/sessionQuery";
import { ProfileCard } from "./ProfileCard";

const account: AuthAccount = {
  createdAt: "2026-08-13T12:00:00.000Z",
  email: "cameron.farina@example.com",
  id: "account-cam",
  updatedAt: "2026-08-13T12:00:00.000Z",
};

const jsonResponse = (body: unknown, status = 200): Response => new Response(
  JSON.stringify(body),
  { headers: { "content-type": "application/json" }, status },
);

const deferredResponse = () => {
  let resolveResponse: ((response: Response) => void) | undefined;
  const promise = new Promise<Response>(resolve => { resolveResponse = resolve; });
  return {
    promise,
    resolve(response: Response) {
      if (resolveResponse === undefined) throw new Error("Response resolver was not initialized.");
      resolveResponse(response);
    },
  };
};

const renderCard = (overrides: Partial<AuthAccount> = {}) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(sessionQueryKey(), {
    account,
    onboarding: { intent: "practice", providers: null, stage: "providers" },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ProfileCard account={{ ...account, ...overrides }} />
    </QueryClientProvider>,
  );
  return { queryClient, user: userEvent.setup() };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProfileCard", () => {
  it("starts from the saved display name", () => {
    renderCard({ displayName: "Cam Farina" });

    expect(screen.getByLabelText("Display name")).toHaveValue("Cam Farina");
    expect(screen.getByText("CF")).toBeVisible();
  });

  it("starts empty and hints at the email fallback when no name is saved", () => {
    renderCard();

    expect(screen.getByLabelText("Display name")).toHaveValue("");
    expect(screen.getByText(/cameron\.farina/u)).toBeVisible();
  });

  it("says photo uploads are not available", () => {
    renderCard();

    expect(screen.getByText(/Photo uploads are not available yet/u)).toBeVisible();
  });

  it("cannot be saved until the name changes", async () => {
    const { user } = renderCard({ displayName: "Cam" });
    const save = screen.getByRole("button", { name: "Save display name" });

    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText("Display name"), "eron");

    expect(save).toBeEnabled();
  });

  it("previews the avatar as the name is typed", async () => {
    const { user } = renderCard();

    await user.type(screen.getByLabelText("Display name"), "Cam Farina");

    expect(screen.getByText("CF")).toBeVisible();
  });

  it("saves the name and refreshes the cached session", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse({ account: { ...account, displayName: "Cam Farina" } }),
    ));
    const { queryClient, user } = renderCard();

    await user.type(screen.getByLabelText("Display name"), "Cam Farina");
    await user.click(screen.getByRole("button", { name: "Save display name" }));

    expect(await screen.findByText("Display name saved.")).toBeVisible();
    await waitFor(() => {
      expect(queryClient.getQueryData(sessionQueryKey()))
        .toMatchObject({
          account: { displayName: "Cam Farina" },
          onboarding: { intent: "practice", stage: "providers" },
        });
    });
  });

  it("reports a rejected name and keeps what was typed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      error: { code: "invalid_display_name", message: "Display name is too long." },
    }, 400)));
    const { user } = renderCard();

    await user.type(screen.getByLabelText("Display name"), "Cam Farina");
    await user.click(screen.getByRole("button", { name: "Save display name" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Display name is too long.");
    expect(screen.getByLabelText("Display name")).toHaveValue("Cam Farina");
  });

  it("does not restore a session cache cleared while the save is pending", async () => {
    const pending = deferredResponse();
    vi.stubGlobal("fetch", vi.fn(() => pending.promise));
    const { queryClient, user } = renderCard();

    await user.type(screen.getByLabelText("Display name"), "Cam Farina");
    await user.click(screen.getByRole("button", { name: "Save display name" }));
    queryClient.removeQueries({ queryKey: sessionQueryKey() });
    pending.resolve(jsonResponse({ account: { ...account, displayName: "Cam Farina" } }));

    expect(await screen.findByText("Display name saved.")).toBeVisible();
    expect(queryClient.getQueryData(sessionQueryKey())).toBeUndefined();
  });

  it("blocks a second save while one is in flight", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>(() => undefined)));
    const { user } = renderCard();

    await user.type(screen.getByLabelText("Display name"), "Cam");
    await user.click(screen.getByRole("button", { name: "Save display name" }));

    expect(await screen.findByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(screen.getByLabelText("Display name")).toBeDisabled();
  });
});
