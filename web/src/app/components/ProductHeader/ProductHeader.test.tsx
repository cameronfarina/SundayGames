import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { sessionQueryKey } from "../../../features/auth/api/sessionQuery";
import { onboardingQueryOptions } from "../../../shared/api/onboarding/onboardingQuery";
import type { Onboarding } from "../../../shared/api/onboarding/onboardingSchema";
import { ProductHeader } from "./ProductHeader";

beforeAll(() => {
  Object.defineProperties(Element.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: () => undefined },
    scrollIntoView: { configurable: true, value: () => undefined },
    setPointerCapture: { configurable: true, value: () => undefined },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const commissionerLeague: Onboarding["leagues"][number] = {
  canManageLeague: true,
  leagueId: "league-sunday",
  leagueName: "Sunday Games",
  liveDraft: null,
  membership: { role: "owner" },
  readiness: { leagueSetup: "ready", liveDraft: "ready", teamClaim: "ready" },
  seasonId: "season-2026",
  seasonYear: 2026,
};

const memberLeague: Onboarding["leagues"][number] = {
  canManageLeague: false,
  leagueId: "league-work",
  leagueName: "Work League",
  liveDraft: null,
  membership: { role: "member" },
  readiness: { leagueSetup: "ready", liveDraft: "needs_attention", teamClaim: "ready" },
  seasonId: "season-work",
  seasonYear: 2026,
};

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
};

const renderHeader = (leagues: Onboarding["leagues"], initialEntry: string) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(sessionQueryKey(), {
    account: {
      createdAt: "2026-08-13T12:00:00.000Z",
      email: "example.user@example.com",
      id: "account-example",
      updatedAt: "2026-08-13T12:00:00.000Z",
    },
  });
  queryClient.setQueryData(onboardingQueryOptions().queryKey, {
    account: { email: "example.user@example.com", id: "account-example" },
    leagues,
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <ProductHeader />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("ProductHeader", () => {
  it("switches leagues in the URL and derives commissioner access from the active league", async () => {
    const user = userEvent.setup();
    renderHeader([commissionerLeague, memberLeague], "/practice?seasonId=season-2026&runId=old&sessionId=old&simulationRun=3&view=targets");

    expect(screen.getByRole("link", { name: "Commissioner" })).toBeVisible();
    await user.click(screen.getByRole("combobox", { name: "Active league" }));
    await user.click(screen.getByRole("option", { name: "Work League · 2026" }));

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/practice?seasonId=season-work&view=targets",
    );
    expect(screen.queryByRole("link", { name: "Commissioner" })).not.toBeInTheDocument();
  });

  it("carries the active league through primary navigation", async () => {
    const user = userEvent.setup();
    renderHeader([commissionerLeague], "/practice?seasonId=season-2026");

    expect(screen.queryByRole("combobox", { name: "Active league" })).not.toBeInTheDocument();
    expect(screen.getByText("Sunday Games · 2026")).toBeVisible();
    await user.click(screen.getByRole("link", { name: "My team" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/my-team?seasonId=season-2026");
    await user.click(screen.getByRole("link", { name: "Player news" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/player-news?seasonId=season-2026");
  });

  it("keeps the core product navigation available without a league", () => {
    renderHeader([], "/practice");

    expect(screen.getByRole("link", { name: "Practice" })).toBeVisible();
    expect(screen.getByRole("link", { name: "League" })).toBeVisible();
    expect(screen.getByRole("link", { name: "My team" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Player news" })).toBeVisible();
    expect(screen.getByText("No active league")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Commissioner" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account menu" })).toHaveTextContent("EU");
  });

  it("falls back to the first league when a saved season is no longer available", async () => {
    const user = userEvent.setup();
    renderHeader([commissionerLeague, memberLeague], "/practice?seasonId=archived");

    expect(screen.getByRole("combobox", { name: "Active league" })).toHaveTextContent(
      "Sunday Games · 2026",
    );
    await user.click(screen.getByRole("link", { name: "League" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/league?seasonId=season-2026");
  });

  it("renders usable account and league fallbacks while protected data loads", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>(() => undefined)));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/practice"]}>
          <ProductHeader />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("No active league")).toBeVisible();
    expect(screen.getByRole("button", { name: "Account menu" })).toHaveTextContent("A");
  });
});
