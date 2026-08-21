import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";
import { renderMockDraft } from "../../test/renderMockDraft.js";
import { snakeMockResponseFixture } from "../../test/snakeMockResponseFixture.js";
import { MockDraftPage } from "./MockDraftPage.js";

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  headers: { "content-type": "application/json" },
  status,
});

const renderSnakeMock = (fetcher: PlatformFetch) => {
  renderMockDraft(
    <MockDraftPage fetcher={fetcher} initialSessionId="mock-1" seasonId="season-1" />,
  );
};

describe("MockDraftPage snake", () => {
  it("shows the draft board, who is up, and the picks already made", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(snakeMockResponseFixture()));
    renderSnakeMock(fetcher);

    expect(await screen.findByRole("heading", { name: "Snake mock draft" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Draft board" })).toBeInTheDocument();
    expect(screen.getAllByText("Jahmyr Gibbs").length).toBeGreaterThan(0);
    expect(screen.getAllByText("On the clock").length).toBeGreaterThan(0);
    expect(screen.getByText("1 / 4 picked")).toBeInTheDocument();
    expect(screen.getAllByText("1.02").length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: "Draft tendencies" }))
      .not.toBeInTheDocument();
  });

  it("sends a pick command for the player the manager drafts", async () => {
    const bodies: string[] = [];
    const fetcher: PlatformFetch = (_input, init) => {
      if (typeof init?.body === "string") bodies.push(init.body);
      return Promise.resolve(jsonResponse(snakeMockResponseFixture()));
    };
    renderMockDraft(
      <MockDraftPage fetcher={fetcher} initialSessionId="mock-1" seasonId="season-1" />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Draft Ja'Marr Chase" }));

    const pickBody = bodies.find(body => body.includes("\"pick\""));
    expect(pickBody).toBeDefined();
    expect(pickBody).toContain("\"playerId\":\"chase\"");
  });

  it("swaps the board for the results once the mock completes", async () => {
    const response = snakeMockResponseFixture();
    const completed = {
      ...response,
      state: { ...response.state, session: { ...response.state.session, status: "completed" } },
    };
    const withResults = vi.fn().mockResolvedValue(jsonResponse({
      ...completed,
      results: {
        projectedPlayerCount: 2,
        rosteredPlayerCount: 1,
        teams: [{
          isUserTeam: true,
          rank: 1,
          roster: [{
            overallPick: 1,
            playerId: "gibbs",
            playerName: "Jahmyr Gibbs",
            position: "RB",
            rosterSlot: "RB1",
            source: "ai",
            starter: true,
            week1Points: 12,
          }],
          teamId: "team-owner11",
          teamName: "Short King",
          week1Points: 12,
        }],
      },
    }));
    renderSnakeMock(withResults);

    expect((await screen.findAllByText("Short King")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: "Draft board" })).not.toBeInTheDocument();
  });

  it("warns when a completed mock has no results to show", async () => {
    const response = snakeMockResponseFixture();
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      ...response,
      state: { ...response.state, session: { ...response.state.session, status: "completed" } },
    }));
    renderSnakeMock(fetcher);

    expect(await screen.findByText("Completed results are unavailable for this mock."))
      .toBeVisible();
  });

  it("keeps the draft button disabled when another team is on the clock", async () => {
    const response = snakeMockResponseFixture();
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      ...response,
      state: {
        ...response.state,
        session: {
          ...response.state.session,
          currentPick: { overall: 1, pickInRound: 1, round: 1, teamId: "team-owner04" },
        },
      },
    }));
    renderSnakeMock(fetcher);

    expect(await screen.findByRole("button", { name: "Draft Ja'Marr Chase" })).toBeDisabled();
  });
});
