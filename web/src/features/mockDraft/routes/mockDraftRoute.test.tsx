import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { MockDraftPageProps } from "../pages/MockDraftPage/MockDraftPage";
import { MockDraftRoutePage } from "./mockDraftRoute";

vi.mock("../pages/MockDraftPage/MockDraftPage", () => ({
  MockDraftPage: ({ initialSessionId, onSessionChange, seasonId }: MockDraftPageProps) => (
    <button onClick={() => { onSessionChange?.("mock-2"); }} type="button">
      {seasonId}:{initialSessionId ?? "new"}
    </button>
  ),
}));

const Location = () => <output>{useLocation().search}</output>;

describe("MockDraftRoutePage", () => {
  it("requires an active league season", () => {
    render(<MemoryRouter><MockDraftRoutePage /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "Choose a league first" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Open League" })).toHaveAttribute("href", "/league");
  });

  it("opens and persists a mock session for the active season", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/mock-drafts?seasonId=season-1&sessionId=mock-1"]}>
        <MockDraftRoutePage />
        <Location />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "season-1:mock-1" }));

    expect(screen.getByText("?seasonId=season-1&sessionId=mock-2")).toBeVisible();
  });
});
