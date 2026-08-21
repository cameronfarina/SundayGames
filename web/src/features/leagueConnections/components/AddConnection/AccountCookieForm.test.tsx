import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccountCookieForm } from "./AccountCookieForm";

const renderForm = (overrides: Partial<Parameters<typeof AccountCookieForm>[0]> = {}) => {
  const utils = {
    espnS2: "s2-value",
    hasLeagueHandle: true,
    onEspnS2Change: vi.fn(),
    onSubmit: vi.fn(),
    onSwidChange: vi.fn(),
    pending: false,
    swid: "{GUID}",
    ...overrides,
  };
  render(<AccountCookieForm {...utils} />);
  return utils;
};

describe("AccountCookieForm", () => {
  it("masks both session values until the owner chooses to reveal them", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.getByLabelText("espn_s2 cookie")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("SWID cookie")).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show ESPN cookie values" }));

    expect(screen.getByLabelText("espn_s2 cookie")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("SWID cookie")).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide ESPN cookie values" })).toBeVisible();
  });

  it("discloses that the values are expiring account session credentials", () => {
    renderForm();

    expect(screen.getByRole("heading", { name: "Experimental private-league sync" }))
      .toBeVisible();
    expect(screen.getByText(/account session credentials/u)).toBeVisible();
    expect(screen.getByText(/ESPN expires these credentials/u)).toBeVisible();
    expect(screen.getAllByRole("listitem").map(step => step.textContent.slice(0, 12))).toEqual([
      "Open fantasy",
      "Open your br",
      "Choose https",
      "Copy the val",
      "Paste both b",
    ]);
  });

  it("opens ESPN in a new tab without handing it this page", () => {
    renderForm();

    const link = screen.getByRole("link", { name: "fantasy.espn.com" });
    expect(link).toHaveAttribute("href", "https://fantasy.espn.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("shows the SWID shape so the braces are not dropped", async () => {
    const user = userEvent.setup();
    const utils = renderForm({ espnS2: "saved-s2", swid: "" });

    expect(screen.getByText(/Looks like \{AAAAAAAA-BBBB/u)).toBeVisible();
    expect(screen.getByLabelText("espn_s2 cookie")).toHaveValue("saved-s2");
    await user.type(screen.getByLabelText("SWID cookie"), "{{");

    expect(utils.onSwidChange).toHaveBeenCalledWith("{");
  });

  it("reports espn_s2 keystrokes back to the caller", async () => {
    const user = userEvent.setup();
    const utils = renderForm({ espnS2: "" });

    await user.type(screen.getByLabelText("espn_s2 cookie"), "s");

    expect(utils.onEspnS2Change).toHaveBeenCalledWith("s");
  });

  it("searches the named private league when both cookies are in place", async () => {
    const user = userEvent.setup();
    const utils = renderForm();

    await user.click(screen.getByRole("button", { name: "Find this private league" }));

    expect(utils.onSubmit).toHaveBeenCalledOnce();
  });

  it("waits for both cookies before it will search", () => {
    renderForm({ swid: "  " });

    expect(screen.getByRole("button", { name: "Find this private league" })).toBeDisabled();
  });

  it("requires the private league link before using account credentials", () => {
    renderForm({ hasLeagueHandle: false });

    expect(screen.getByRole("button", { name: "Find this private league" })).toBeDisabled();
  });

  it("blocks a second search while ESPN is still answering", () => {
    renderForm({ pending: true });

    expect(screen.getByRole("button", { name: "Looking..." })).toBeDisabled();
  });
});
