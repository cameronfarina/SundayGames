import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { renderMyTeamPage } from "./MyTeamPage.testUtils";
import { assignedLeague, onboarding, server } from "./MyTeamPage.testServer";

describe("MyTeamPage states", () => {
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

  it("announces loading while the active league is unresolved", () => {
    server.use(http.get("/onboarding", async () => await new Promise<Response>(() => undefined)));
    renderMyTeamPage();

    expect(screen.getByRole("status")).toHaveTextContent("Loading your team");
  });

  it("guides an account without a league", async () => {
    const user = userEvent.setup();
    server.use(http.get("/onboarding", () => HttpResponse.json({
      account: { id: "account-user", email: "user@example.com" },
      leagues: [],
    })));
    renderMyTeamPage();

    expect(await screen.findByRole("heading", { name: "Your team starts with a league" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Create league" })).toHaveAttribute("href", "/league?create=1");
    expect(screen.getByRole("link", { name: "Join a league" })).toHaveAttribute("href", "/invite");
    await user.tab();
    expect(screen.getByRole("link", { name: "Create league" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Join a league" })).toHaveFocus();
  });

  it("guides a league member who has not claimed a team", async () => {
    const unassigned = {
      ...assignedLeague,
      membership: { role: "member" },
      readiness: { ...assignedLeague.readiness, teamClaim: "needs_attention" },
    };
    server.use(http.get("/onboarding", () => HttpResponse.json(onboarding(unassigned))));
    renderMyTeamPage();

    expect(await screen.findByRole("heading", { name: "Claim your team" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Choose team" })).toHaveAttribute(
      "href",
      "/leagues/sunday-games#claim-your-team",
    );
  });

  it("shows a recoverable request error", async () => {
    server.use(http.get("/onboarding", () => HttpResponse.json({
      error: { code: "onboarding_unavailable", message: "League onboarding is unavailable." },
    }, { status: 503 })));
    renderMyTeamPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("League onboarding is unavailable.");
  });

  it("rejects an invalid successful response", async () => {
    server.use(http.get("/onboarding", () => HttpResponse.json({ leagues: "invalid" })));
    renderMyTeamPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The server returned data that does not match the application contract.",
    );
  });
});
