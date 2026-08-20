import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  leagueServer,
  onboarding,
  renderLeaguePage,
  resetLeaguePages,
  useLeagueApi,
} from "./LeaguePage.testSupport";
import { HttpResponse, http } from "msw";

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

describe("LeaguePage states", () => {
  it("gives accounts without a league clear next steps", async () => {
    useLeagueApi({ account: { id: "user-1", email: "user@example.com" }, leagues: [] });
    renderLeaguePage();

    expect(await screen.findByRole("heading", { name: "Your leagues" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Create a league" })).toHaveAttribute("href", "/league?create=1");
    expect(screen.getByText(/private invitation link/i)).toBeVisible();
    expect(screen.getByRole("link", { name: "Import the leagues you already play in" }))
      .toHaveAttribute("href", "/connections");
  });

  it("does not silently replace a stale requested league", async () => {
    useLeagueApi(onboarding({ claimed: true }));
    renderLeaguePage("/league?seasonId=missing");

    expect(await screen.findByRole("heading", { name: "League unavailable" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Open active league" })).toHaveAttribute("href", "/league");
  });

  it("shows a recoverable onboarding error", async () => {
    let requestCount = 0;
    useLeagueApi(onboarding({ claimed: true }));
    leagueServer.use(http.get("/onboarding", () => {
      requestCount += 1;
      return requestCount === 1
        ? HttpResponse.json({
            error: { code: "onboarding_unavailable", message: "League onboarding is unavailable." },
          }, { status: 503 })
        : HttpResponse.json(onboarding({ claimed: true }));
    }));
    const user = userEvent.setup();
    renderLeaguePage();

    expect(await screen.findByRole("alert")).toHaveTextContent("League onboarding is unavailable.");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Sunday Games" })).toBeVisible();
  });

  it("rejects malformed season responses", async () => {
    useLeagueApi(onboarding({ claimed: true }), { season: { id: 2 } });
    renderLeaguePage();

    expect(await screen.findByRole("alert")).toHaveTextContent(/does not match/i);
  });

  it("reports keeper loading failures", async () => {
    useLeagueApi(onboarding({ claimed: true }));
    leagueServer.use(http.get("/seasons/:seasonId/keepers", () => HttpResponse.json({
      error: { code: "keepers_unavailable", message: "Keepers are unavailable." },
    }, { status: 503 })));
    renderLeaguePage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Keepers are unavailable.");
  });
});
