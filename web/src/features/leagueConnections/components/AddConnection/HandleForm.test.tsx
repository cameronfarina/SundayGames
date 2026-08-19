import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { providerCatalogFixture } from "../../api/leagueConnections.fixture";
import { HandleForm } from "./HandleForm";

const sleeper = providerCatalogFixture.at(0);
const espn = providerCatalogFixture.at(1);

const renderForm = (
  overrides: Partial<Parameters<typeof HandleForm>[0]> = {},
) => {
  if (sleeper === undefined) throw new Error("Expected a provider fixture.");
  const utils = {
    espnS2: "",
    handle: "feiyingx",
    onEspnS2Change: vi.fn(),
    onHandleChange: vi.fn(),
    onSubmit: vi.fn(),
    onSwidChange: vi.fn(),
    pending: false,
    provider: sleeper,
    showCookieStep: false,
    swid: "",
    ...overrides,
  };
  render(<HandleForm {...utils} />);
  return utils;
};

const espnForm = (
  overrides: Partial<Parameters<typeof HandleForm>[0]> = {},
) => {
  if (espn === undefined) throw new Error("Expected the ESPN provider fixture.");
  return renderForm({ handle: "899513", provider: espn, ...overrides });
};

describe("HandleForm", () => {
  it("labels the input in the provider's own words and asks for nothing else", () => {
    renderForm();

    expect(screen.getByRole("textbox", { name: "Sleeper username" })).toBeVisible();
    expect(screen.getByText("Your Sleeper username, or a league ID if you know it.")).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "espn_s2 cookie" })).not.toBeInTheDocument();
  });

  it("offers to find several leagues when one handle can name many", () => {
    renderForm();

    expect(screen.getByRole("button", { name: "Find my leagues" })).toBeVisible();
  });

  it("offers to connect straight away when the handle names one league", () => {
    espnForm();

    expect(screen.getByRole("button", { name: "Connect league" })).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "espn_s2 cookie" })).not.toBeInTheDocument();
  });

  it("submits the search when the form is sent", async () => {
    const user = userEvent.setup();
    const utils = renderForm();

    await user.click(screen.getByRole("button", { name: "Find my leagues" }));

    expect(utils.onSubmit).toHaveBeenCalledOnce();
  });

  it("reports every keystroke back to the caller", async () => {
    const user = userEvent.setup();
    const utils = espnForm({ handle: "", showCookieStep: true });

    await user.type(screen.getByRole("textbox", { name: "ESPN league ID or league URL" }), "8");
    await user.type(screen.getByRole("textbox", { name: "espn_s2 cookie" }), "s");
    await user.type(screen.getByRole("textbox", { name: "SWID cookie" }), "g");

    expect(utils.onHandleChange).toHaveBeenCalledWith("8");
    expect(utils.onEspnS2Change).toHaveBeenCalledWith("s");
    expect(utils.onSwidChange).toHaveBeenCalledWith("g");
  });

  it("explains the private-league step and links out to ESPN once cookies are needed", () => {
    espnForm({ showCookieStep: true });

    expect(screen.getByRole("heading", { name: "This league is private" })).toBeVisible();
    expect(screen.getByText(/does not offer a "sign in with ESPN" button/u)).toBeVisible();
    expect(screen.getByRole("link", { name: "fantasy.espn.com" }))
      .toHaveAttribute("href", "https://fantasy.espn.com");
    expect(screen.getByRole("link", { name: "fantasy.espn.com" }))
      .toHaveAttribute("target", "_blank");
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByText(/Keep the curly braces around SWID/u)).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again with these cookies" })).toBeVisible();
  });

  it("says it is connecting while the league is being pulled in", () => {
    espnForm({ pending: true });

    expect(screen.getByRole("button", { name: "Connecting..." })).toBeDisabled();
  });

  it("blocks a search with nothing but whitespace typed", () => {
    renderForm({ handle: "   " });

    expect(screen.getByRole("button", { name: "Find my leagues" })).toBeDisabled();
  });
});
