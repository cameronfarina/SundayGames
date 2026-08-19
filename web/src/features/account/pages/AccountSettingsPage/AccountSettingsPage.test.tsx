import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { connectionListFixture } from "../../../leagueConnections/api/leagueConnections.fixture";
import { AccountSettingsPage } from "./AccountSettingsPage";

const account = {
  createdAt: "2026-08-13T12:00:00.000Z",
  email: "cameron.farina@example.com",
  id: "account-cam",
  updatedAt: "2026-08-13T12:00:00.000Z",
};

const server = setupServer();

const stubEveryEndpoint = (accountOverrides: Record<string, unknown> = {}) => {
  server.use(
    http.get("/session", () => HttpResponse.json({ account: { ...account, ...accountOverrides } })),
    http.get("/onboarding", () => HttpResponse.json({
      account: { email: account.email, id: account.id },
      leagues: [],
    })),
    http.get("/league-connections", () => HttpResponse.json(connectionListFixture)),
  );
};

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/account-settings"]}>
        <AccountSettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeAll(() => { server.listen({ onUnhandledRequest: "error" }); });
afterEach(() => { server.resetHandlers(); });
afterAll(() => { server.close(); });

describe("AccountSettingsPage", () => {
  it("waits for the account before showing anything about it", () => {
    stubEveryEndpoint();
    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Loading your account...");
  });

  it("carries the profile, sign-in and connected-league sections", async () => {
    stubEveryEndpoint({ displayName: "Cam Farina" });
    renderPage();

    expect(await screen.findByRole("heading", { name: "Profile" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Connected leagues" })).toBeVisible();
    expect(screen.getByLabelText("Display name")).toHaveValue("Cam Farina");
  });

  it("saves a new display name from the page", async () => {
    stubEveryEndpoint();
    server.use(http.put("/session/profile", () =>
      HttpResponse.json({ account: { ...account, displayName: "Cam Farina" } })));
    renderPage();
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Display name"), "Cam Farina");
    await user.click(screen.getByRole("button", { name: "Save display name" }));

    expect(await screen.findByText("Display name saved.")).toBeVisible();
  });

  it("summarises the connected leagues", async () => {
    stubEveryEndpoint();
    renderPage();

    // The fixture holds one synced league and one needing attention.
    expect(await screen.findByText("2 leagues")).toBeVisible();
    expect(screen.getAllByText("1 league")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Manage connections" }))
      .toHaveAttribute("href", "/connections");
  });
});
