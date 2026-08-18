import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";
import { auctionSeason, jsonResponse, withStoredHistoricalImports } from "../../test/commissionerFixtures";
import { HistoricalImportSection } from "./HistoricalImportSection";

const renderSection = (fetcher: PlatformFetch) => {
  vi.stubGlobal("fetch", withStoredHistoricalImports(fetcher, () => []));
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <HistoricalImportSection season={auctionSeason} />
    </QueryClientProvider>,
  );
};

describe("HistoricalImportSection draft year", () => {
  afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("keeps invalid years local and restores importing for a valid year", async () => {
    const fetcher: PlatformFetch = vi.fn(() => Promise.resolve(jsonResponse({})));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderSection(fetcher);
    const user = userEvent.setup();
    await user.upload(
      screen.getByLabelText("Choose historical draft files"),
      new File(["draft"], "draft-2024.csv"),
    );
    const year = screen.getByLabelText("Draft year");
    const importButton = screen.getByRole("button", { name: "Import 1 file" });

    await user.clear(year);
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a whole year from 2000 to 2100.");
    expect(importButton).toBeDisabled();
    expect(fetcher).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();

    for (const invalidYear of ["1999", "2101", "2024.5"]) {
      await user.clear(year);
      await user.type(year, invalidYear);
      expect(screen.getByRole("alert")).toHaveTextContent("Enter a whole year from 2000 to 2100.");
      expect(importButton).toBeDisabled();
      expect(fetcher).not.toHaveBeenCalled();
    }

    await user.clear(year);
    await user.type(year, "2000");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(importButton).toBeEnabled();
  });
});
