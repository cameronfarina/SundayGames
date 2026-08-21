import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionQueryKey } from "../../../features/auth/api/sessionQuery";
import { onboardingQueryOptions } from "../../../shared/api/onboarding/onboardingQuery";
import { AppLayout } from "./AppLayout";

const completedOnboarding: {
  readonly intent: null;
  readonly providers: null;
  readonly stage: "complete";
} = {
  intent: null,
  providers: null,
  stage: "complete",
};

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

const renderLayout = (onboarding: typeof completedOnboarding | {
  readonly intent: null;
  readonly providers: null;
  readonly stage: "intent";
} | "missing" = completedOnboarding) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(sessionQueryKey(), {
    account: {
      createdAt: "2026-08-13T12:00:00.000Z",
      email: "user@example.com",
      id: "account-user",
      updatedAt: "2026-08-13T12:00:00.000Z",
    },
    ...(onboarding === "missing" ? {} : { onboarding }),
  });
  queryClient.setQueryData(onboardingQueryOptions().queryKey, {
    account: { email: "user@example.com", id: "account-user" },
    leagues: [],
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/practice"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="practice" element={<h1>Draft lab</h1>} />
            <Route path="league" element={<h1>League home</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AppLayout", () => {
  it("offers keyboard users a skip link and focusable page content", async () => {
    const user = userEvent.setup();
    renderLayout();

    screen.getByRole("main").blur();
    await user.tab();
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveFocus();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  it("uses client navigation without replacing the document", async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole("link", { name: "League" }));

    expect(await screen.findByRole("heading", { name: "League home" })).toBeVisible();
    expect(document.title).toBe("League | Sunday Games");
  });

  it("gates protected product routes when the signed-in account still needs setup", async () => {
    renderLayout({ intent: null, providers: null, stage: "intent" });

    expect(screen.getByRole("dialog", { name: "Welcome to Sunday Games" })).toBeVisible();
    expect(screen.getByText("Step 1 of 3")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "Welcome to Sunday Games" })).toBeVisible();
  });

  it("blocks product access when required setup data does not load and lets it retry", async () => {
    const retry = deferredResponse();
    vi.stubGlobal("fetch", vi.fn(() => retry.promise));
    const user = userEvent.setup();
    renderLayout("missing");

    expect(screen.getByRole("dialog", { name: "Finish account setup" }))
      .toHaveClass("signup-wizard-recovery-dialog");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("button", { name: "Retrying..." })).toBeDisabled();
    retry.resolve(Response.json({
      account: {
        createdAt: "2026-08-13T12:00:00.000Z",
        email: "user@example.com",
        id: "account-user",
        updatedAt: "2026-08-13T12:00:00.000Z",
      },
      onboarding: completedOnboarding,
    }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Finish account setup" }))
        .not.toBeInTheDocument();
    });
  });
});
