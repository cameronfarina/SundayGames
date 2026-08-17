import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { sessionQueryKey } from "../../../features/auth/api/sessionQuery";
import { onboardingQueryOptions } from "../../../shared/api/onboarding/onboardingQuery";
import type { Onboarding } from "../../../shared/api/onboarding/onboardingSchema";
import { ProductHeader } from "./ProductHeader";
import { ProductNavigation } from "./ProductNavigation";
import { useActiveLeague } from "./hooks/useActiveLeague";

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
  leagueSlug: "sunday-games",
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
  leagueSlug: "work-league",
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

const ActiveLeagueProbe = () => {
  const { activeLeague, setActiveLeague } = useActiveLeague();
  const location = useLocation();
  return <>
    <output data-testid="active-league">{activeLeague?.leagueName ?? "Baseline"}</output>
    <output data-testid="active-location">{location.pathname}{location.search}</output>
    <button onClick={() => { setActiveLeague("missing"); }} type="button">Choose missing league</button>
    <button onClick={() => { setActiveLeague("season-work"); }} type="button">Choose work league</button>
  </>;
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

const renderActiveLeagueProbe = (initialEntry: string) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  queryClient.setQueryData(onboardingQueryOptions().queryKey, {
    account: { email: "example.user@example.com", id: "account-example" },
    leagues: [commissionerLeague, memberLeague],
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}><ActiveLeagueProbe /></MemoryRouter>
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
      "/leagues/work-league/practice?view=targets",
    );
    expect(screen.queryByRole("link", { name: "Commissioner" })).not.toBeInTheDocument();
  });

  it("carries the active league through primary navigation", async () => {
    const user = userEvent.setup();
    renderHeader([commissionerLeague], "/leagues/sunday-games/practice");

    expect(screen.queryByRole("combobox", { name: "Active league" })).not.toBeInTheDocument();
    expect(screen.getByText("Sunday Games · 2026")).toBeVisible();
    await user.click(screen.getByRole("link", { name: "My team" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/leagues/sunday-games/my-team");
    await user.click(screen.getByRole("link", { name: "Player news" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/leagues/sunday-games/player-news");
  });

  it("keeps the core product navigation available without a league", () => {
    renderHeader([], "/practice");

    expect(screen.getByRole("link", { name: "Practice" })).toBeVisible();
    expect(screen.getByRole("link", { name: "League" })).toBeVisible();
    expect(screen.getByRole("link", { name: "My team" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Player news" })).toBeVisible();
    expect(screen.getByText("No active league")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Commissioner" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account menu" })).toHaveTextContent("E");
  });

  it("keeps commissioner navigation on the legacy route before a league is active", () => {
    render(<MemoryRouter><ProductNavigation activeLeague={undefined} canManageLeague /></MemoryRouter>);

    expect(screen.getByRole("link", { name: "Commissioner" })).toHaveAttribute("href", "/commissioner");
  });

  it("marks only the current page's tab active on league subpages", () => {
    render(
      <MemoryRouter initialEntries={["/leagues/sunday-games/practice"]}>
        <ProductNavigation activeLeague={commissionerLeague} canManageLeague={false} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Practice" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "League" })).not.toHaveAttribute("aria-current");
  });

  it("supports baseline mode and ignores unavailable league selections", async () => {
    const user = userEvent.setup();
    renderActiveLeagueProbe("/practice?seasonId=baseline");

    expect(screen.getByTestId("active-league")).toHaveTextContent("Baseline");
    await user.click(screen.getByRole("button", { name: "Choose missing league" }));
    expect(screen.getByTestId("active-location")).toHaveTextContent("/practice?seasonId=baseline");
  });

  it("falls back to Practice when switching leagues from an unrelated page", async () => {
    const user = userEvent.setup();
    renderActiveLeagueProbe("/unrelated");

    await user.click(screen.getByRole("button", { name: "Choose work league" }));
    expect(screen.getByTestId("active-location")).toHaveTextContent("/leagues/work-league/practice");
  });

  it("falls back to the first league when a saved season is no longer available", async () => {
    const user = userEvent.setup();
    renderHeader([commissionerLeague, memberLeague], "/practice?seasonId=archived");

    expect(screen.getByRole("combobox", { name: "Active league" })).toHaveTextContent(
      "Sunday Games · 2026",
    );
    await user.click(screen.getByRole("link", { name: "League" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/leagues/sunday-games");
  });

  it("replaces a legacy identifier URL with its clean league route", async () => {
    renderHeader(
      [commissionerLeague],
      "/player-news?seasonId=season-2026&roomId=room-private&source=rotowire",
    );

    expect(await screen.findByTestId("location")).toHaveTextContent(
      "/leagues/sunday-games/player-news?source=rotowire",
    );
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
