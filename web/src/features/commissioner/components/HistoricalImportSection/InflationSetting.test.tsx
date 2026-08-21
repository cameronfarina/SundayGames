import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";
import { seasonSchema } from "../../api/seasonSchemas";
import { auctionSeason, jsonResponse, requestBody } from "../../test/commissionerFixtures";
import { InflationSetting } from "./InflationSetting";

const savedBodies: unknown[] = [];

const bodyField = (body: unknown, field: string): unknown =>
  body !== null && typeof body === "object" && field in body
    ? Object.getOwnPropertyDescriptor(body, field)?.value
    : undefined;

const respond: PlatformFetch = (_input, init) => {
  savedBodies.push(JSON.parse(requestBody(init) || "{}"));
  return Promise.resolve(jsonResponse({ season: auctionSeason }));
};

const openInflation = (
  options: { importedYearCount?: number; multiplier?: number; fetcher?: PlatformFetch } = {},
) => {
  vi.stubGlobal("fetch", vi.fn(options.fetcher ?? respond));
  const season = options.multiplier === undefined
    ? auctionSeason
    : seasonSchema.parse({
      ...auctionSeason,
      settings: { ...auctionSeason.settings, manualInflationMultiplier: options.multiplier },
    });
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <InflationSetting importedYearCount={options.importedYearCount ?? 0} season={season} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
};

const percentBox = () => screen.getByLabelText("Inflation percentage");

describe("InflationSetting", () => {
  afterEach(() => { vi.unstubAllGlobals(); savedBodies.length = 0; });

  it("says the percentage only applies when no import can be priced", () => {
    openInflation();

    expect(screen.getByText(/used only when imported results cannot be compared/u)).toBeInTheDocument();
    expect(screen.queryByText(/draft years imported/u)).not.toBeInTheDocument();
  });

  it("says imported results lead once a draft year exists", () => {
    openInflation({ importedYearCount: 3 });

    expect(screen.getByText(/You have 3 draft years imported/u)).toBeInTheDocument();
  });

  it("counts a single imported year in the singular", () => {
    openInflation({ importedYearCount: 1 });

    expect(screen.getByText(/You have 1 draft year imported/u)).toBeInTheDocument();
  });

  it("shows a saved multiplier back as a percentage", () => {
    openInflation({ multiplier: 1.2 });

    expect(percentBox()).toHaveValue(120);
  });

  it("saves a typed percentage", async () => {
    const user = openInflation();
    await user.type(percentBox(), "120");

    await user.click(screen.getByRole("button", { name: "Save percentage" }));

    await waitFor(() => { expect(screen.getByRole("status")).toBeInTheDocument(); });
    expect(savedBodies).toEqual([{ inflationPercent: 120 }]);
  });

  it("cannot save a percentage outside the range a league could pay", async () => {
    const user = openInflation();
    await user.type(percentBox(), "0");

    expect(screen.getByText("Enter a whole percentage from 1 to 1000.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save percentage" })).toBeDisabled();
  });

  it("cannot save an empty box and reports no error for one", () => {
    openInflation();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save percentage" })).toBeDisabled();
  });

  it("cannot save a percentage that is already saved", () => {
    openInflation({ multiplier: 1.2 });

    expect(screen.getByRole("button", { name: "Save percentage" })).toBeDisabled();
  });

  it("clears a saved percentage by sending nothing", async () => {
    const user = openInflation({ multiplier: 1.2 });

    await user.click(screen.getByRole("button", { name: "Clear" }));

    await waitFor(() => { expect(savedBodies).toHaveLength(1); });
    expect(savedBodies[0]).toEqual({});
    expect(percentBox()).toHaveValue(null);
  });

  it("has nothing to clear when no percentage is saved", () => {
    openInflation();

    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
  });

  it("reports a rejected percentage from the server", async () => {
    const user = openInflation({
      fetcher: () => Promise.resolve(jsonResponse({
        error: { code: "inflation_locked", message: "Pricing is locked after the live draft starts." },
      }, 409)),
    });
    await user.type(percentBox(), "120");

    await user.click(screen.getByRole("button", { name: "Save percentage" }));

    await waitFor(() => {
      expect(screen.getByRole("alert"))
        .toHaveTextContent("Pricing is locked after the live draft starts.");
    });
  });

  it("drops a stale success message once the box is edited again", async () => {
    const user = openInflation();
    await user.type(percentBox(), "120");
    await user.click(screen.getByRole("button", { name: "Save percentage" }));
    await waitFor(() => { expect(screen.getByRole("status")).toBeInTheDocument(); });

    await user.type(percentBox(), "5");

    await waitFor(() => { expect(screen.queryByRole("status")).not.toBeInTheDocument(); });
    expect(bodyField(savedBodies[0], "inflationPercent")).toBe(120);
  });
});
