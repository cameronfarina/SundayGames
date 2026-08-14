import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { RouteEffects } from "./RouteEffects";

function RouteHarness() {
  const navigate = useNavigate();
  return (
    <>
      <RouteEffects />
      <button onClick={() => void navigate("/league")} type="button">League</button>
      <main data-route-focus tabIndex={-1}>Page</main>
    </>
  );
}

describe("RouteEffects", () => {
  it("updates the title and focuses page content after client navigation", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/practice"]}><RouteHarness /></MemoryRouter>);

    await waitFor(() => {
      expect(document.title).toBe("Draft lab | Mockd");
    });
    await user.click(screen.getByRole("button", { name: "League" }));

    await waitFor(() => {
      expect(document.title).toBe("League | Mockd");
    });
    expect(screen.getByRole("main")).toHaveFocus();
  });
});
