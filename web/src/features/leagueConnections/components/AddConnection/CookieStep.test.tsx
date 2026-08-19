import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CookieStep } from "./CookieStep";

describe("CookieStep", () => {
  it("says why there is no sign-in button before asking for anything", () => {
    render(<CookieStep espnS2="" onEspnS2Change={vi.fn()} onSwidChange={vi.fn()} swid="" />);

    expect(screen.getByRole("heading", { name: "This league is private" })).toBeVisible();
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
    render(<CookieStep espnS2="" onEspnS2Change={vi.fn()} onSwidChange={vi.fn()} swid="" />);

    const link = screen.getByRole("link", { name: "fantasy.espn.com" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("shows the SWID shape so the braces are not dropped", async () => {
    const user = userEvent.setup();
    const onSwidChange = vi.fn();
    render(<CookieStep
      espnS2="saved-s2"
      onEspnS2Change={vi.fn()}
      onSwidChange={onSwidChange}
      swid=""
    />);

    expect(screen.getByText(/Looks like \{AAAAAAAA-BBBB/u)).toBeVisible();
    expect(screen.getByRole("textbox", { name: "espn_s2 cookie" })).toHaveValue("saved-s2");
    await user.type(screen.getByRole("textbox", { name: "SWID cookie" }), "{{");

    expect(onSwidChange).toHaveBeenCalledWith("{");
  });
});
