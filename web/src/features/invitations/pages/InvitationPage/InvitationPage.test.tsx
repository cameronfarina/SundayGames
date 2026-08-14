import { HttpResponse, delay, http } from "msw";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  invitationDetails,
  invitationServer,
  renderInvitationPage,
  resetInvitationPages,
  useInvitationApi,
} from "./InvitationPage.testSupport";

beforeAll(() => {
  invitationServer.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  resetInvitationPages();
  invitationServer.resetHandlers();
});
afterAll(() => {
  invitationServer.close();
});

describe("InvitationPage", () => {
  it("explains a missing token without making a request", () => {
    renderInvitationPage("/invite");
    expect(screen.getByRole("alert")).toHaveTextContent("missing its token");
  });

  it("shows league context and safe auth actions when signed out", async () => {
    useInvitationApi(false);
    renderInvitationPage();

    expect(await screen.findByRole("heading", { name: "Join Sunday Games" })).toBeVisible();
    expect(screen.getByText("Short King")).toBeVisible();
    expect(screen.getByText("Claimed")).toBeVisible();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?returnTo=%2Finvite%3Ftoken%3Dsecret",
    );
  });

  it("lets a signed-in account claim an available team", async () => {
    useInvitationApi(true);
    invitationServer.use(http.post("/invitations/claim", () => HttpResponse.json({
      membership: {
        userId: "user-1",
        leagueId: "league-1",
        role: "member",
        ownerId: "owner-1",
        teamId: "team-1",
      },
    })));
    const user = userEvent.setup();
    renderInvitationPage();

    await user.click(await screen.findByRole("button", { name: "Join as Short King" }));
    expect(await screen.findByRole("heading", { name: "League destination" })).toBeVisible();
  });

  it("opens the league when the account already has a team", async () => {
    useInvitationApi(true);
    invitationServer.use(http.get("/onboarding", () => HttpResponse.json({
      account: { id: "user-1", email: "cam@example.com" },
      leagues: [{ seasonId: "season-1", membership: { teamId: "team-1" } }],
    })));
    renderInvitationPage();

    expect(await screen.findByRole("link", { name: "Open league" })).toHaveAttribute(
      "href",
      "/league?seasonId=season-1",
    );
    expect(screen.getByText("Your team")).toBeVisible();
  });

  it("renders invitation errors and empty team lists", async () => {
    useInvitationApi(false);
    invitationServer.use(http.get("/invitations/details", () => HttpResponse.json({
      error: { code: "invitation_expired", message: "This invitation has expired." },
    }, { status: 410 })));
    const view = renderInvitationPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("expired");

    view.unmount();
    useInvitationApi(false);
    invitationServer.use(http.get("/invitations/details", () => HttpResponse.json({
      ...invitationDetails,
      teams: [],
    })));
    renderInvitationPage();
    expect(await screen.findByText("No teams are configured for this league.")).toBeVisible();
  });

  it("reports session failures", async () => {
    useInvitationApi(false);
    invitationServer.use(http.get("/session", () => HttpResponse.json({
      error: { code: "session_unavailable", message: "Session is unavailable." },
    }, { status: 503 })));
    renderInvitationPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Session is unavailable.");
  });

  it("shows a manager fallback and claim progress before reporting an error", async () => {
    useInvitationApi(true);
    invitationServer.use(
      http.get("/invitations/details", () => HttpResponse.json({
        ...invitationDetails,
        teams: [{ ...invitationDetails.teams[0], managerNames: undefined }],
      })),
      http.post("/invitations/claim", async () => {
        await delay(40);
        return HttpResponse.json({
          error: { code: "team_unavailable", message: "That team was already claimed." },
        }, { status: 409 });
      }),
    );
    const user = userEvent.setup();
    renderInvitationPage();

    expect(await screen.findByText("Manager name not provided")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Join as Short King" }));
    expect(screen.getByRole("button", { name: "Join as Short King" })).toBeDisabled();
    expect(await screen.findByRole("alert")).toHaveTextContent("That team was already claimed.");
  });
});
