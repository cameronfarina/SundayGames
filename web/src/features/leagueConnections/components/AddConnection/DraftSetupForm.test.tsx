import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { DraftSetupForm } from "./DraftSetupForm";

beforeAll(() => {
  Object.defineProperties(Element.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: () => undefined },
    scrollIntoView: { configurable: true, value: () => undefined },
    setPointerCapture: { configurable: true, value: () => undefined },
  });
});

const defaults = {
  auctionBudgetDollars: 200,
  minimumBidDollars: 1,
  snakeRounds: 16,
};

describe("DraftSetupForm", () => {
  it("keeps labels associated when several leagues need draft settings", () => {
    const onSubmit = vi.fn();
    render(<>
      <DraftSetupForm defaults={defaults} disabled={false} onSubmit={onSubmit} />
      <DraftSetupForm defaults={defaults} disabled={false} onSubmit={onSubmit} />
    </>);

    const selects = screen.getAllByRole("combobox", { name: "Draft format" });
    expect(selects).toHaveLength(2);
    expect(selects[0]?.id).not.toBe(selects[1]?.id);
  });

  it("submits the provider defaults after auction is chosen", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<DraftSetupForm defaults={defaults} disabled={false} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("combobox", { name: "Draft format" }));
    await user.click(screen.getByRole("option", { name: "Auction" }));
    await user.clear(screen.getByRole("spinbutton", { name: "Auction budget" }));
    await user.type(screen.getByRole("spinbutton", { name: "Auction budget" }), "250");
    await user.clear(screen.getByRole("spinbutton", { name: "Minimum bid" }));
    await user.type(screen.getByRole("spinbutton", { name: "Minimum bid" }), "2");
    await user.click(screen.getByRole("button", { name: "Finish import" }));

    expect(onSubmit).toHaveBeenCalledWith({
      type: "auction",
      budgetDollars: 250,
      minimumBidDollars: 2,
    });
  });

  it("submits snake rounds and prevents an unchosen format", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<DraftSetupForm defaults={defaults} disabled={false} onSubmit={onSubmit} />);

    expect(screen.getByRole("button", { name: "Finish import" })).toBeDisabled();
    await user.click(screen.getByRole("combobox", { name: "Draft format" }));
    await user.click(screen.getByRole("option", { name: "Snake" }));
    await user.clear(screen.getByRole("spinbutton", { name: "Rounds" }));
    await user.type(screen.getByRole("spinbutton", { name: "Rounds" }), "12");
    await user.click(screen.getByRole("button", { name: "Finish import" }));

    expect(onSubmit).toHaveBeenCalledWith({ type: "snake", rounds: 12 });
  });
});
