import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { auctionSeason } from "../../test/commissionerFixtures";
import type { HistoricalFileItem } from "../../model/historicalFileQueue";
import { HistoricalFileRow } from "./HistoricalFileRow";

const itemWith = (ownerNeeds: readonly string[]): HistoricalFileItem => ({
  file: new File(["a"], "results-2023.csv"),
  id: "file-1",
  message: "Match historical teams below, then import again.",
  ownerMappings: {},
  ownerNeeds,
  seasonYear: "2023",
  status: "mapping",
});

describe("HistoricalFileRow", () => {
  it("names each historical team that needs a mapping", () => {
    render(<HistoricalFileRow
      dispatch={vi.fn()}
      item={itemWith(["Marty"])}
      teams={auctionSeason.teams}
    />);

    expect(screen.getByText("Historical team: Marty")).toBeInTheDocument();
  });

  it("labels a blank team cell readably instead of showing an empty name", () => {
    render(<HistoricalFileRow
      dispatch={vi.fn()}
      item={itemWith(["", "  "])}
      teams={auctionSeason.teams}
    />);

    expect(screen.getAllByText("Historical team: (blank team cell in file)")).toHaveLength(2);
    expect(screen.queryByText(/^Historical team: $/u)).not.toBeInTheDocument();
  });
});
