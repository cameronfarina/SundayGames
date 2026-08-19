import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";
import { auctionSeason, jsonResponse, requestBody, requestPath } from "../../test/commissionerFixtures";
import { SlotPriceImport } from "./SlotPriceImport";

const previewRequests: unknown[] = [];

const requestField = (request: unknown, field: string): unknown =>
  request !== null && typeof request === "object" && field in request
    ? Object.getOwnPropertyDescriptor(request, field)?.value
    : undefined;

const seasonYearsRequested = (): unknown[] =>
  previewRequests.map(request => requestField(request, "seasonYear"));

const respond: PlatformFetch = (input, init) => {
  if (requestPath(input).includes("commit")) {
    return Promise.resolve(jsonResponse({
      batch: { id: "batch-1", status: "committed" },
      committedRecords: [{ playerName: "RB1" }, { playerName: "RB2" }],
    }));
  }
  previewRequests.push(JSON.parse(requestBody(init) || "{}"));
  return Promise.resolve(jsonResponse({
    source: { sourceWarnings: [] },
    batch: { id: "batch-1", status: "previewed", blockers: [], warnings: [], rows: [] },
  }));
};

const openSlotImport = (fetcher: PlatformFetch = respond) => {
  vi.stubGlobal("fetch", vi.fn(fetcher));
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <SlotPriceImport season={auctionSeason} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
};

const paste = async (user: ReturnType<typeof userEvent.setup>, text: string) => {
  const box = screen.getByLabelText("Slot prices");
  await user.click(box);
  await user.paste(text);
};

describe("SlotPriceImport", () => {
  afterEach(() => { vi.unstubAllGlobals(); previewRequests.length = 0; });

  it("explains the columns and shows an example before anything is pasted", () => {
    openSlotImport();

    expect(screen.getByText(/One row per slot/u)).toBeInTheDocument();
    expect(screen.getByText("Slot,Price,Season")).toBeInTheDocument();
    expect(screen.getByText(/sold for \$1 or \$2 are saved but do not change/u)).toBeInTheDocument();
  });

  it("cannot import an empty paste", () => {
    openSlotImport();

    expect(screen.getByRole("button", { name: /Import 0 draft years/u })).toBeDisabled();
  });

  it("imports a single-season paste under the chosen draft year", async () => {
    const user = openSlotImport();
    await paste(user, "Slot,Price\nRB1,75");

    await user.click(screen.getByRole("button", { name: "Import 1 draft year" }));

    await waitFor(() => { expect(screen.getByText(/2 slots imported/u)).toBeInTheDocument(); });
    expect(previewRequests).toEqual([{
      replacementRequested: false,
      seasonId: auctionSeason.id,
      seasonYear: 2025,
      sourceText: "Slot,Price\nRB1,75",
    }]);
  });

  it("counts a draft year for each price column in the paste", async () => {
    const user = openSlotImport();
    await paste(user, "Slot,2024,2023\nRB1,75,68");

    expect(screen.getByRole("button", { name: "Import 2 draft years" })).toBeEnabled();
  });

  it("imports every year the paste names", async () => {
    const user = openSlotImport();
    await paste(user, "Slot,2024,2023\nRB1,75,68");

    await user.click(screen.getByRole("button", { name: "Import 2 draft years" }));

    await waitFor(() => { expect(screen.getAllByText(/slots imported/u)).toHaveLength(2); });
    expect(seasonYearsRequested()).toEqual([2024, 2023]);
  });

  it("sends the replacement flag when the commissioner asks to replace a year", async () => {
    const user = openSlotImport();
    await paste(user, "Slot,Price\nRB1,75");
    await user.click(screen.getByLabelText("Replace slot prices for the same year"));

    await user.click(screen.getByRole("button", { name: "Import 1 draft year" }));

    await waitFor(() => { expect(previewRequests).toHaveLength(1); });
    expect(requestField(previewRequests[0], "replacementRequested")).toBe(true);
  });

  it("uses an edited draft year for a paste that names no year of its own", async () => {
    const user = openSlotImport();
    await paste(user, "Slot,Price\nRB1,75");
    const yearField = screen.getByLabelText("Draft year for this paste");
    await user.clear(yearField);
    await user.type(yearField, "2022");

    await user.click(screen.getByRole("button", { name: "Import 1 draft year" }));

    await waitFor(() => { expect(previewRequests).toHaveLength(1); });
    expect(requestField(previewRequests[0], "seasonYear")).toBe(2022);
  });

  it("refuses to import while the draft year is not a real year", async () => {
    const user = openSlotImport();
    await paste(user, "Slot,Price\nRB1,75");
    await user.clear(screen.getByLabelText("Draft year for this paste"));

    expect(screen.getByText("Enter a whole year from 2000 to 2100.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Import 0 draft years/u })).toBeDisabled();
  });

  it("names the year that could not be imported", async () => {
    const user = openSlotImport(() => Promise.resolve(jsonResponse({
      source: {},
      batch: {
        id: "batch-1",
        status: "blocked",
        blockers: [{ code: "position_invalid", message: "Position must be QB, RB, WR, TE, K, or DST." }],
        warnings: [],
        rows: [],
      },
    })));
    await paste(user, "Slot,Price\nFLEX1,75");

    await user.click(screen.getByRole("button", { name: "Import 1 draft year" }));

    await waitFor(() => {
      expect(screen.getByRole("alert"))
        .toHaveTextContent("2025: Position must be QB, RB, WR, TE, K, or DST.");
    });
  });

  it("clears an earlier result once the paste is edited again", async () => {
    const user = openSlotImport();
    await paste(user, "Slot,Price\nRB1,75");
    await user.click(screen.getByRole("button", { name: "Import 1 draft year" }));
    await waitFor(() => { expect(screen.getByText(/2 slots imported/u)).toBeInTheDocument(); });

    await paste(user, "\nRB2,72");

    await waitFor(() => { expect(screen.queryByText(/2 slots imported/u)).not.toBeInTheDocument(); });
  });
});
