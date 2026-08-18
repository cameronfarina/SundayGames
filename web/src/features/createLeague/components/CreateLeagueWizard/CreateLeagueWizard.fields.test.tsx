import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import { renderCreateLeagueWizard } from "../../test/renderCreateLeagueWizard";

beforeAll(() => {
  Object.defineProperties(Element.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: () => undefined },
    scrollIntoView: { configurable: true, value: () => undefined },
    setPointerCapture: { configurable: true, value: () => undefined },
  });
});

const chooseManualSetup = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByRole("textbox", { name: "League name" }), "Sunday Games");
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(screen.getByRole("button", { name: "Enter settings manually" }));
  await user.click(screen.getByRole("button", { name: "Next" }));
};

describe("CreateLeagueWizard fields", () => {
  it("validates cleared setup values and supports snake and auction formats", async () => {
    const user = userEvent.setup();
    renderCreateLeagueWizard();
    await user.type(screen.getByRole("textbox", { name: "League name" }), "Sunday Games");
    for (const name of ["Season", "Number of teams", "Auction budget", "Minimum bid"]) {
      await user.clear(screen.getByRole("spinbutton", { name }));
    }
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getAllByRole("alert")).toHaveLength(4);
    await user.type(screen.getByRole("spinbutton", { name: "Season" }), "2026");
    await user.type(screen.getByRole("spinbutton", { name: "Number of teams" }), "12");
    await user.type(screen.getByRole("spinbutton", { name: "Auction budget" }), "250");
    await user.type(screen.getByRole("spinbutton", { name: "Minimum bid" }), "2");
    const format = screen.getByRole("combobox", { name: "Draft format" });
    await user.click(format);
    await user.click(screen.getByRole("option", { name: "Snake" }));
    expect(screen.queryByRole("spinbutton", { name: "Auction budget" })).not.toBeInTheDocument();
    const rounds = screen.getByRole("spinbutton", { name: "Draft rounds" });
    expect(rounds).toHaveValue(16);
    await user.clear(rounds);
    await user.type(rounds, "20");
    expect(screen.getByRole("spinbutton", { name: "Draft rounds" })).toHaveValue(20);
    await user.click(format);
    await user.click(screen.getByRole("option", { name: "Auction" }));
    expect(screen.queryByRole("spinbutton", { name: "Draft rounds" })).not.toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Auction budget" })).toHaveValue(250);
  });

  it("orders scoring and roster fields and blocks invalid values", async () => {
    const user = userEvent.setup();
    renderCreateLeagueWizard();
    await chooseManualSetup(user);
    expect(screen.getAllByRole("spinbutton").map(input => input.getAttribute("aria-label")))
      .toEqual([
        "Points per passing yard", "Points per passing touchdown", "Points per rushing yard",
        "Points per rushing touchdown", "Points per receiving yard",
        "Points per receiving touchdown", "Points per reception",
      ]);
    await user.clear(screen.getByRole("spinbutton", { name: "Points per reception" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid point value.");
    await user.type(screen.getByRole("spinbutton", { name: "Points per reception" }), "0.5");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getAllByRole("spinbutton").map(input => input.getAttribute("aria-label")))
      .toEqual(["QB", "RB", "WR", "TE", "FLEX", "DST", "K", "Bench"]);
    for (const input of screen.getAllByRole("spinbutton")) await user.clear(input);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getAllByRole("alert")).toHaveLength(8);
    for (const input of screen.getAllByRole("spinbutton")) await user.type(input, "0");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getAllByRole("alert").map(alert => alert.textContent))
      .toContain("Add at least one draftable roster slot.");
  });

  it("shows team errors when an incomplete team form is submitted", async () => {
    const user = userEvent.setup();
    renderCreateLeagueWizard();
    await chooseManualSetup(user);
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(/commissioners can add keepers in Commissioner after creating the league/i))
      .toBeVisible();
    fireEvent.submit(screen.getByRole("form", { name: "League team setup" }));
    expect(screen.getAllByText("Enter a team name.")).toHaveLength(12);
  });
});
