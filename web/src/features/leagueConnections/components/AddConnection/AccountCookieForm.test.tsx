import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccountCookieForm } from "./AccountCookieForm";

const renderForm = (overrides: Partial<Parameters<typeof AccountCookieForm>[0]> = {}) => {
  const utils = {
    espnS2: "s2-value",
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
  it("says why there is no sign-in button before asking for anything", () => {
    renderForm();

    expect(screen.getByRole("heading", { name: "Find every league on your ESPN account" }))
      .toBeVisible();
    expect(screen.getByText(/It is a one-time step/u)).toBeVisible();
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
    expect(screen.getByRole("textbox", { name: "espn_s2 cookie" })).toHaveValue("saved-s2");
    await user.type(screen.getByRole("textbox", { name: "SWID cookie" }), "{{");

    expect(utils.onSwidChange).toHaveBeenCalledWith("{");
  });

  it("reports espn_s2 keystrokes back to the caller", async () => {
    const user = userEvent.setup();
    const utils = renderForm({ espnS2: "" });

    await user.type(screen.getByRole("textbox", { name: "espn_s2 cookie" }), "s");

    expect(utils.onEspnS2Change).toHaveBeenCalledWith("s");
  });

  it("searches the whole account when both cookies are in place", async () => {
    const user = userEvent.setup();
    const utils = renderForm();

    await user.click(screen.getByRole("button", { name: "Find all my leagues" }));

    expect(utils.onSubmit).toHaveBeenCalledOnce();
  });

  it("waits for both cookies before it will search", () => {
    renderForm({ swid: "  " });

    expect(screen.getByRole("button", { name: "Find all my leagues" })).toBeDisabled();
  });

  it("blocks a second search while ESPN is still answering", () => {
    renderForm({ pending: true });

    expect(screen.getByRole("button", { name: "Looking..." })).toBeDisabled();
  });
});
