import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PracticePage } from "./PracticePage";
import { createPracticeFetch } from "./test/createPracticeFetch";

afterEach(() => { vi.unstubAllGlobals(); });

const providersFor = (entry: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Providers({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}><MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter></QueryClientProvider>;
  };
};

describe("PracticePage states", () => {
  it("shows a loading status while Practice context is pending", () => {
    vi.stubGlobal("fetch", () => new Promise<Response>(() => undefined));
    const view = render(<PracticePage />, { wrapper: providersFor("/practice") });

    expect(screen.getByRole("status")).toHaveTextContent("Loading Practice");
    view.unmount();
  });

  it("keeps the baseline board useful before a user joins a league", async () => {
    vi.stubGlobal("fetch", createPracticeFetch({ hasLeague: false }));
    const view = render(<PracticePage />, { wrapper: providersFor("/practice") });

    expect(await screen.findByText("Baseline values")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create league" })).toHaveAttribute("href", "/league?create=1");
    expect(await screen.findByRole("button", { name: "Add Puka Nacua to simulation plan" })).toBeDisabled();
    expect(screen.queryByRole("heading", { name: "Run full-league drafts" })).not.toBeInTheDocument();
    view.unmount();
  });

  it("shows an actionable error when Practice context cannot load", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", createPracticeFetch({ contextError: true }));
    const view = render(<PracticePage />, { wrapper: providersFor("/practice") });

    expect(await screen.findByRole("heading", { name: "Practice is unavailable" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Draft lab" })).toBeInTheDocument();
    view.unmount();
  });

  it("handles an empty catalog and an unclaimed league team", async () => {
    vi.stubGlobal("fetch", createPracticeFetch({ catalogEmpty: true, teamClaimed: false }));
    const view = render(<PracticePage />, { wrapper: providersFor("/practice?seasonId=season-1") });

    expect(await screen.findByText("No players are available for this board yet.")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Claim a team" }))
      .toHaveAttribute("href", "/leagues/sunday-games#claim-your-team");
    expect(screen.getByRole("button", { name: "Run simulations" })).toBeDisabled();
    view.unmount();
  });

  it("recovers when the player catalog request fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", createPracticeFetch({ catalogError: true }));
    const view = render(<PracticePage />, { wrapper: providersFor("/practice?seasonId=season-1") });

    expect(await screen.findByText("Catalog unavailable.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry board" }));
    expect(await screen.findByRole("button", { name: "Remove Puka Nacua from simulation plan" })).toBeInTheDocument();
    view.unmount();
  });

  it("shows shortlist and saved-run request failures", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", createPracticeFetch({ detailError: true, targetError: true }));
    const view = render(<PracticePage />, { wrapper: providersFor("/practice?seasonId=season-1") });

    const maxBid = await screen.findByLabelText("Maximum bid for Puka Nacua");
    await user.clear(maxBid);
    await user.type(maxBid, "70");
    await user.click(screen.getByRole("button", { name: "Save Puka Nacua maximum bid" }));
    expect(await screen.findByText("Target could not be saved.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Open 1-run simulation/ }));
    expect(await screen.findByText("Saved run unavailable.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry saved run" }));
    expect(await screen.findByText("Saved run unavailable.")).toBeInTheDocument();
    view.unmount();
  });

  it("recovers when simulation history cannot load", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", createPracticeFetch({ historyError: true }));
    const view = render(<PracticePage />, { wrapper: providersFor("/practice?seasonId=season-1") });

    expect(await screen.findByText("History unavailable.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry history" }));
    expect(await screen.findByRole("heading", { name: "Previous runs" })).toBeInTheDocument();
    view.unmount();
  });

  it("reports and retries a selected roster run failure", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", createPracticeFetch({ runDetailError: true }));
    const view = render(<PracticePage />, { wrapper: providersFor("/practice?seasonId=season-1") });

    await user.click(await screen.findByRole("button", { name: /Open 1-run simulation/u }));
    expect(await screen.findByText("Roster run unavailable.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry selected run" }));
    expect(await screen.findByText("Roster run unavailable.")).toBeInTheDocument();
    view.unmount();
  });

  it("falls back to the first run for an invalid run URL", async () => {
    vi.stubGlobal("fetch", createPracticeFetch());
    const view = render(<PracticePage />, {
      wrapper: providersFor("/practice?seasonId=season-1&runId=history-1&simulationRun=invalid"),
    });

    expect(await screen.findByRole("combobox", { name: "Simulation outcome" })).toHaveTextContent("Run 1");
    expect(await screen.findByRole("heading", { name: "Short King" })).toBeInTheDocument();
    view.unmount();
  });
});
