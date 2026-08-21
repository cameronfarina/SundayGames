import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";
import {
  auctionSeason,
  jsonResponse,
  requestPath,
  snakeSeason,
  withStoredHistoricalImports,
} from "../../test/commissionerFixtures";
import { HistoricalImportSection } from "./HistoricalImportSection";

beforeAll(() => {
  Object.defineProperties(Element.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: () => undefined },
    scrollIntoView: { configurable: true, value: () => undefined },
    setPointerCapture: { configurable: true, value: () => undefined },
  });
});

const preview = (status: "blocked" | "previewed", ownerLabel?: string) => ({
  source: {},
  batch: {
    id: "batch-1", status, blockers: status === "blocked" ? [{ code: "owner_unknown", message: "Map owner." }] : [],
    warnings: [], rows: ownerLabel === undefined ? [] : [
      { blockers: [{ code: "owner_unknown", message: "Map owner." }],
        identityAudit: { sourceOwnerOrTeamLabel: ownerLabel } },
      { blockers: [{ code: "owner_ambiguous", message: "Map owner." }],
        identityAudit: { sourceOwnerOrTeamLabel: ownerLabel } },
      { blockers: [{ code: "missing_player", message: "Player missing." }] },
      { blockers: [{ code: "owner_unknown", message: "Owner missing." }] },
    ],
  },
});

const renderSection = (
  fetcher: PlatformFetch,
  snake = false,
  storedYears: () => readonly number[] = () => [],
) => {
  vi.stubGlobal("fetch", withStoredHistoricalImports(fetcher, storedYears));
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    <HistoricalImportSection season={snake ? snakeSeason : auctionSeason} />
  </QueryClientProvider>);
};

describe("HistoricalImportSection", () => {
  afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

  it("keeps full auction files primary and positional prices advanced", async () => {
    renderSection(vi.fn(() => Promise.resolve(jsonResponse(preview("previewed")))));
    const user = userEvent.setup();

    expect(screen.getByLabelText("Choose historical draft files")).toBeVisible();
    expect(screen.getByText(/Upload complete auction draft results/u)).toBeVisible();
    expect(screen.getByText(/one CSV, TSV, or XLSX file per draft year/u)).toBeVisible();
    expect(screen.getByText(/Add Public Value to compare a sale with published market prices/u))
      .toBeVisible();
    expect(screen.getByText(/Team header and Price, Position, and Player columns for each team/u))
      .toBeVisible();
    expect(screen.getByLabelText("Slot prices")).not.toBeVisible();
    expect(screen.getByText("Set an inflation percentage by hand")).toBeVisible();

    await user.click(screen.getByText("Advanced price import"));

    expect(screen.getByLabelText("Slot prices")).toBeVisible();
  });

  it("explains the unavailable snake history without auction controls", () => {
    renderSection(vi.fn(() => Promise.resolve(jsonResponse(preview("previewed")))), true);

    expect(screen.getByText("Unavailable")).toBeVisible();
    expect(screen.queryByText("0 imported")).not.toBeInTheDocument();
    expect(screen.getByText(/Historical snake draft imports and manager personality modeling are not available/u))
      .toBeVisible();
    expect(screen.queryByLabelText("Choose historical draft files")).not.toBeInTheDocument();
    expect(screen.queryByText("Advanced price import")).not.toBeInTheDocument();
    expect(screen.queryByText("Set an inflation percentage by hand")).not.toBeInTheDocument();
  });

  it("imports valid files independently when another file fails", async () => {
    const respond: PlatformFetch = (input, init) => {
      const path = requestPath(input);
      if (path.includes("commit")) return Promise.resolve(jsonResponse({
        batch: { id: "batch-1", status: "committed" }, committedRecords: [{ playerName: "Puka Nacua" }],
      }));
      const body = typeof init?.body === "string" ? init.body : "";
      if (body.includes("draft-2024.csv")) return Promise.resolve(jsonResponse(preview("previewed")));
      return Promise.resolve(jsonResponse({ error: { code: "bad_sheet", message: "Columns are missing." } }, 422));
    };
    const fetcher = vi.fn(respond);
    renderSection(fetcher);
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText("Choose historical draft files"), [
      new File(["good"], "draft-2024.csv"), new File(["bad"], "draft-2023.csv"),
    ]);
    await user.click(screen.getByRole("button", { name: "Import 2 files" }));

    expect(await screen.findByText("1 players imported")).toBeVisible();
    expect(screen.getByText("Columns are missing.")).toBeVisible();
  });

  it("counts draft years already stored for the league before any upload", async () => {
    renderSection(vi.fn(() => Promise.resolve(jsonResponse(preview("previewed")))), false, () => [2025, 2024, 2023]);

    expect(await screen.findByText("3 imported")).toBeVisible();
  });

  it("recounts stored draft years after an import succeeds", async () => {
    const storedYears: number[] = [];
    const respond: PlatformFetch = input => {
      if (requestPath(input).includes("commit")) {
        storedYears.push(2024);
        return Promise.resolve(jsonResponse({
          batch: { id: "batch-1", status: "committed" }, committedRecords: [{ playerName: "Puka Nacua" }],
        }));
      }
      return Promise.resolve(jsonResponse(preview("previewed")));
    };
    renderSection(vi.fn(respond), false, () => storedYears);
    const user = userEvent.setup();
    expect(await screen.findByText("0 imported")).toBeVisible();
    await user.upload(screen.getByLabelText("Choose historical draft files"), new File(["good"], "draft-2024.csv"));
    await user.click(screen.getByRole("button", { name: "Import 1 file" }));

    expect(await screen.findByText("1 imported")).toBeVisible();
  });

  it("collects team mappings and retries a blocked preview", async () => {
    let previews = 0;
    const bodies: string[] = [];
    const respond: PlatformFetch = (input, init) => {
      bodies.push(typeof init?.body === "string" ? init.body : "");
      if (requestPath(input).includes("commit")) return Promise.resolve(jsonResponse({
        batch: { id: "batch-1", status: "committed" }, committedRecords: [],
      }));
      previews += 1;
      return Promise.resolve(jsonResponse(previews < 3 ? preview("blocked", "Old Cam") : preview("previewed")));
    };
    const fetcher = vi.fn(respond);
    renderSection(fetcher);
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText("Choose historical draft files"), new File(["x"], "draft-2024.xlsx"));
    await user.click(screen.getByRole("button", { name: "Import 1 file" }));
    expect(await screen.findByText("Match historical teams below, then import again.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Import 1 file" })).toBeDisabled();
    await user.click(screen.getByRole("combobox", { name: "Historical team: Old Cam" }));
    expect(screen.getByRole("listbox")).toBeVisible();
    await user.click(screen.getByRole("option", { name: "Short King" }));
    await user.click(screen.getByRole("button", { name: "Import 1 file" }));
    expect(await screen.findByText("Map owner.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Import 1 file" }));
    expect(await screen.findByText("0 players imported")).toBeVisible();
    expect(bodies[1]).toContain("Old Cam");
  });

  it("supports drag and drop, editing, removal, duplicate warnings, and snake messaging", async () => {
    const fetcher: PlatformFetch = vi.fn(() => Promise.resolve(jsonResponse(preview("blocked"))));
    const view = renderSection(fetcher);
    const dropzone = screen.getByRole("button", { name: /Drop draft files here/u });
    await userEvent.setup().click(dropzone);
    fireEvent.dragOver(dropzone);
    expect(dropzone).toHaveClass("is-dragging");
    fireEvent.dragLeave(dropzone);
    expect(dropzone).not.toHaveClass("is-dragging");
    fireEvent.dragOver(dropzone);
    fireEvent.drop(dropzone, { dataTransfer: { files: [new File(["x"], "draft-2024.tsv")] } });
    const user = userEvent.setup();
    const input = screen.getByLabelText("Choose historical draft files");
    fireEvent.change(input, { target: { files: null } });
    await user.upload(input, new File(["y"], "other-2024.csv", { type: "text/csv" }));
    expect(screen.getByRole("alert")).toHaveTextContent("different draft year");
    const secondYear = screen.getAllByLabelText("Draft year").at(1);
    const firstRemove = screen.getAllByRole("button", { name: "Remove" }).at(0);
    if (secondYear === undefined || firstRemove === undefined) throw new Error("Expected two queued files.");
    await user.clear(secondYear);
    await user.type(secondYear, "2023");
    await user.click(screen.getByLabelText("Replace an import for the same year"));
    await user.click(screen.getByLabelText("Roster row 1 contains each team's keeper"));
    await user.click(firstRemove);
    await user.click(screen.getByRole("button", { name: "Import 1 file" }));
    expect(await screen.findByText("Map owner.")).toBeVisible();
    view.rerender(<QueryClientProvider client={new QueryClient()}>
      <HistoricalImportSection season={snakeSeason} />
    </QueryClientProvider>);
    expect(screen.getByText(/Historical snake draft imports and manager personality modeling/u)).toBeVisible();
  });

  it("reports completed files as a truthful percentage of the current batch", async () => {
    const never = new Promise<Response>(() => undefined);
    const respond: PlatformFetch = (input, init) => {
      const path = requestPath(input);
      const body = typeof init?.body === "string" ? init.body : "";
      if (path.includes("commit")) return Promise.resolve(jsonResponse({
        batch: { id: "batch-1", status: "committed" }, committedRecords: [],
      }));
      if (body.includes("draft-2023.csv")) return never;
      return Promise.resolve(jsonResponse(preview("previewed")));
    };
    renderSection(vi.fn(respond));
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText("Choose historical draft files"), [
      new File(["first"], "draft-2024.csv"),
      new File(["second"], "draft-2023.csv"),
    ]);

    await user.click(screen.getByRole("button", { name: "Import 2 files" }));

    expect(await screen.findByRole("progressbar", { name: "50% complete" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Importing 1 of 2 files" })).toBeDisabled();
  });

});
