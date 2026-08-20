import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { providerCatalogFixture } from "../../api/leagueConnections.fixture";
import { HandleForm } from "./HandleForm";

const sleeper = providerCatalogFixture.at(0);

const renderForm = (overrides: Partial<Parameters<typeof HandleForm>[0]> = {}) => {
  if (sleeper === undefined) throw new Error("Expected a provider fixture.");
  const utils = {
    handle: "feiyingx",
    onHandleChange: vi.fn(),
    onSubmit: vi.fn(),
    pending: false,
    provider: sleeper,
    submitLabel: "Find my leagues",
    ...overrides,
  };
  render(<HandleForm {...utils} />);
  return utils;
};

describe("HandleForm", () => {
  it("labels the input in the provider's own words and asks for nothing else", () => {
    renderForm();

    expect(screen.getByRole("textbox", { name: "Sleeper username" })).toBeVisible();
    expect(screen.getByText("Your Sleeper username, or a league ID if you know it.")).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "espn_s2 cookie" })).not.toBeInTheDocument();
  });

  it("uses the label the caller chose for this path", () => {
    renderForm({ submitLabel: "Find this league" });

    expect(screen.getByRole("button", { name: "Find this league" })).toBeVisible();
  });

  it("submits the search when the form is sent", async () => {
    const user = userEvent.setup();
    const utils = renderForm();

    await user.click(screen.getByRole("button", { name: "Find my leagues" }));

    expect(utils.onSubmit).toHaveBeenCalledOnce();
  });

  it("reports every keystroke back to the caller", async () => {
    const user = userEvent.setup();
    const utils = renderForm({ handle: "" });

    await user.type(screen.getByRole("textbox", { name: "Sleeper username" }), "8");

    expect(utils.onHandleChange).toHaveBeenCalledWith("8");
  });

  it("says it is looking while the provider is still answering", () => {
    renderForm({ pending: true });

    expect(screen.getByRole("button", { name: "Looking..." })).toBeDisabled();
  });

  it("blocks a search with nothing but whitespace typed", () => {
    renderForm({ handle: "   " });

    expect(screen.getByRole("button", { name: "Find my leagues" })).toBeDisabled();
  });
});
