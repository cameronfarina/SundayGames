import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import { HistoricalPricingGuide } from "./HistoricalPricingGuide";

beforeAll(() => {
  Object.defineProperties(Element.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: () => undefined },
    scrollIntoView: { configurable: true, value: () => undefined },
    setPointerCapture: { configurable: true, value: () => undefined },
  });
});

describe("HistoricalPricingGuide", () => {
  it("explains both supported files and provides examples", async () => {
    render(<HistoricalPricingGuide />);
    const user = userEvent.setup();

    expect(screen.getByText("Owner | Player | Position | Price")).toBeVisible();
    expect(screen.getByText("Rank | Player | Position | Price")).toBeVisible();
    expect(screen.getByText(/Rank is the player's rank within the listed position/u)).toBeVisible();
    expect(screen.getByRole("link", { name: "Download a template" }))
      .toHaveAttribute("download", "sunday-games-auction-history-template.csv");
    expect(screen.getByRole("link", { name: "Download a template" }))
      .toHaveAttribute("href", "/sunday-games-auction-history-template.csv");

    await user.click(screen.getByRole("button", { name: "View formatting examples" }));
    expect(screen.getByRole("dialog", { name: "Historical pricing formats" }))
      .toHaveTextContent("Rank,Player,Position,Price,Public Value");
    await user.click(screen.getByRole("button", { name: "Close dialog" }));
  });
});
