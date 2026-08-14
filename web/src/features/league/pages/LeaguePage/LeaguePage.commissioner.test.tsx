import { screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  leagueServer,
  onboarding,
  renderLeaguePage,
  resetLeaguePages,
  useLeagueApi,
} from "./LeaguePage.testSupport";

beforeAll(() => {
  leagueServer.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  resetLeaguePages();
  leagueServer.resetHandlers();
});
afterAll(() => {
  leagueServer.close();
});

describe("LeaguePage commissioner actions", () => {
  it("routes unfinished setup to commissioner tools", async () => {
    useLeagueApi(onboarding({ canManageLeague: true, claimed: true, setupReady: false }));
    renderLeaguePage();

    expect(await screen.findByRole("link", { name: "Finish setup" })).toHaveAttribute(
      "href",
      "/commissioner?seasonId=season-1",
    );
    expect(screen.queryByRole("link", { name: "Enter draft" })).not.toBeInTheDocument();
  });

  it("enters a published room only when one exists", async () => {
    useLeagueApi(onboarding({
      canManageLeague: true,
      claimed: true,
      roomId: "room/1",
    }));
    renderLeaguePage();

    expect(await screen.findByRole("link", { name: "Enter draft" })).toHaveAttribute(
      "href",
      "/draft-room?seasonId=season-1&roomId=room%2F1",
    );
    expect(screen.getByText("Setup")).toBeVisible();
  });

  it("routes a ready commissioner to draft-room creation", async () => {
    useLeagueApi(onboarding({ canManageLeague: true, claimed: true }));
    renderLeaguePage();

    expect(await screen.findByRole("link", { name: "Create draft room" })).toHaveAttribute(
      "href",
      "/commissioner?seasonId=season-1#live-room-setup-title",
    );
  });
});
