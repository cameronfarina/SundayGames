import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { inSeasonTeam } from "../../api/inSeason.fixture";
import { endedLeague, postDraftResult } from "./MyTeamPage.postDraft.fixture";
import { renderMyTeamPage } from "./MyTeamPage.testUtils";
import { onboarding, server, usePreDraftHandlers } from "./MyTeamPage.testServer";

const useInSeasonHandlers = (): void => {
  server.use(
    http.get("/onboarding", () => HttpResponse.json(onboarding(endedLeague))),
    http.get("/live-rooms/room-1/my-team", () => HttpResponse.json(postDraftResult)),
    http.get("/live-rooms/room-1/in-season", () => HttpResponse.json(inSeasonTeam)),
  );
};

describe("MyTeamPage in-season tabs", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });
  afterEach(() => {
    document.body.replaceChildren();
    server.resetHandlers();
  });
  afterAll(() => {
    server.close();
  });

  it("opens lineup help with the consensus disagreement spelled out", async () => {
    useInSeasonHandlers();
    renderMyTeamPage("/my-team?seasonId=season-2026&view=lineup");

    expect(await screen.findByRole("heading", { name: "Start these players" })).toBeVisible();
    expect(screen.getByText(
      "FantasyPros ranks Xavier Legette 3 spots ahead of Cade Otton in this week's consensus.",
    )).toBeVisible();
    expect(screen.getByRole("link", { name: "Lineup" })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByText(/^Data by FantasyPros/u).length).toBeGreaterThan(0);
  });

  it("opens the waiver wire and filters it by position", async () => {
    const user = userEvent.setup();
    useInSeasonHandlers();
    renderMyTeamPage("/my-team?seasonId=season-2026&view=waivers");

    expect(await screen.findByRole("heading", { name: "Free agents worth a claim" })).toBeVisible();
    expect(screen.getByRole("row", { name: /Jalen Coker/u })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "QB" }));
    expect(screen.queryByRole("row", { name: /Jalen Coker/u })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Waivers" })).toHaveAttribute("aria-current", "page");
  });

  it("carries a waiver candidate's FantasyPros news blurb through the wire", async () => {
    useInSeasonHandlers();
    renderMyTeamPage("/my-team?seasonId=season-2026&view=waivers");

    expect(await screen.findByText("Shough is expected to start again in Week 3")).toBeVisible();
  });

  it("marks an injury report on the roster the lineup tab shows", async () => {
    useInSeasonHandlers();
    renderMyTeamPage("/my-team?seasonId=season-2026&view=lineup");

    expect(await screen.findByText("Gibbs is limited in practice with an ankle injury"))
      .toBeVisible();
    expect(screen.getByText("Injury")).toBeVisible();
  });

  it("tells a pre-draft league that these tools unlock after the draft", async () => {
    usePreDraftHandlers();
    renderMyTeamPage("/my-team?seasonId=season-2026&view=lineup");

    expect(await screen.findByRole("heading", { name: "Lineup help opens after your draft" }))
      .toBeVisible();
    expect(screen.getByText("Until then, use Draft prep to build your plan.")).toBeVisible();
  });
});
