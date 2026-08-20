import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SaleLedger } from "./SaleLedger";
import { liveRoom } from "../../test/liveDraftFixtures";

describe("SaleLedger", () => {
  it("searches and corrects active sales", async () => {
    const user = userEvent.setup();
    const onCorrect = vi.fn(() => true);
    render(<SaleLedger
      canCorrect
      onCorrect={onCorrect}
      sales={liveRoom.salesLog}
    />);

    expect(screen.getByText("De'Von Achane")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Correct sale of De'Von Achane" }));
    const command = screen.getByRole("textbox", { name: "Correct sale" });
    expect(command).toHaveValue("Owner11 drafted De'Von Achane for 50");
    await user.clear(command);
    await user.type(command, "Owner04 drafted De'Von Achane for 49");
    await user.click(screen.getByRole("button", { name: "Apply correction" }));
    expect(onCorrect).toHaveBeenCalledExactlyOnceWith(
      "sale-1",
      "Owner04 drafted De'Von Achane for 49",
    );

    await user.click(screen.getByRole("button", { name: "Correct sale of De'Von Achane" }));
    const emptyCommand = screen.getByRole("textbox", { name: "Correct sale" });
    await user.clear(emptyCommand);
    fireEvent.submit(screen.getByRole("form", { name: "Correct sale" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("form", { name: "Correct sale" })).not.toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Search all sales" }), "missing");
    expect(screen.getByText("No sales match this search.")).toBeVisible();
  });

  it("shows an empty ledger and no correction controls for members", () => {
    render(<SaleLedger canCorrect={false} onCorrect={vi.fn(() => false)} sales={[]} />);
    expect(screen.getByText("Sales will appear here for everyone.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Correct sale/ })).not.toBeInTheDocument();
  });

  it("uses pick language and price-less correction commands for snake drafts", async () => {
    const user = userEvent.setup();
    const [sale] = liveRoom.salesLog;
    if (sale === undefined) throw new Error("Expected a sale fixture.");
    render(<SaleLedger
      canCorrect
      draftMode="snake"
      onCorrect={vi.fn(() => true)}
      sales={[{ ...sale, price: undefined }]}
    />);

    expect(screen.getByRole("heading", { name: "All picks" })).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "Search all picks" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Correct pick of De'Von Achane" }));
    expect(screen.getByRole("textbox", { name: "Correct pick" }))
      .toHaveValue("Owner11 drafted De'Von Achane");
    expect(screen.queryByText("-")).not.toBeInTheDocument();
  });
});
