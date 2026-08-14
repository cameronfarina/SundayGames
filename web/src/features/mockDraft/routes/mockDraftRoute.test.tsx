import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter, useLocation, useSearchParams } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { MockDraftPageProps } from "../pages/MockDraftPage/MockDraftPage";
import { MockDraftRoutePage } from "./mockDraftRoute";

vi.mock("../pages/MockDraftPage/MockDraftPage", () => ({
  MockDraftPage: ({ initialSessionId, onSessionChange, seasonId }: MockDraftPageProps) => {
    const [sessionId] = useState(initialSessionId);
    return <>
      <button onClick={() => { onSessionChange?.("mock-2"); }} type="button">
        {seasonId}:{sessionId ?? "new"}
      </button>
      <button onClick={() => { onSessionChange?.(undefined); }} type="button">Clear session</button>
    </>;
  },
}));

const Location = () => <output>{useLocation().search}</output>;
const LeagueSwitch = () => {
  const [params, setParams] = useSearchParams();
  return <button onClick={() => {
    const next = new URLSearchParams(params);
    next.set("seasonId", "season-2");
    next.delete("sessionId");
    setParams(next);
  }} type="button">Switch league</button>;
};

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
    await user.click(screen.getByRole("button", { name: "Clear session" }));
    expect(screen.getByText("?seasonId=season-1")).toBeVisible();
  });

  it("does not carry the previous league session into a new season", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/mock-drafts?seasonId=season-1&sessionId=mock-1"]}>
        <MockDraftRoutePage />
        <LeagueSwitch />
        <Location />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "season-1:mock-1" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Switch league" }));

    expect(screen.getByRole("button", { name: "season-2:new" })).toBeVisible();
    expect(screen.getByText("?seasonId=season-2")).toBeVisible();
  });
});
