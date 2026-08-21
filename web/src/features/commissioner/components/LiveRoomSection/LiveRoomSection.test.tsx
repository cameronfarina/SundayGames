import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";
import { onboardingLeagueSchema } from "../../../../shared/api/onboarding/onboardingSchema";
import { seasonQueryKeys } from "../../../../shared/api/queries/seasonQueryKeys";
import { seasonSchema } from "../../api/seasonSchemas";
import { auctionSeason, jsonResponse, ownerLeague, requestPath, snakeSeason } from "../../test/commissionerFixtures";
import { LiveRoomSection } from "./LiveRoomSection";

const publishedSeason = seasonSchema.parse({ ...auctionSeason, setupStatus: "published" });
const LocationOutput = () => {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}{location.search}</span>;
};

const renderSection = (
  fetcher: PlatformFetch,
  season = auctionSeason,
  league = ownerLeague,
  manageableLeagues = [league],
) => {
  vi.stubGlobal("fetch", fetcher);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(seasonQueryKeys.onboarding(), { leagues: [] });
  client.setQueryData(seasonQueryKeys.leagueSeason(season.id), { season });
  const view = render(<MemoryRouter initialEntries={["/league"]}>
    <QueryClientProvider client={client}>
      <LiveRoomSection league={league} manageableLeagues={manageableLeagues} season={season} />
    </QueryClientProvider>
    <LocationOutput />
  </MemoryRouter>);
  return { ...view, client };
};

describe("LiveRoomSection", () => {
  afterEach(() => { document.body.replaceChildren(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("enters and archives an existing room without offering unsupported schedule editing", async () => {
    const requests: string[] = [];
    const respond: PlatformFetch = (input, init) => {
      requests.push(`${init?.method ?? "GET"} ${requestPath(input)}`);
      if (init?.method === "DELETE") return Promise.resolve(jsonResponse({ ok: true }));
      return Promise.resolve(jsonResponse({ ok: true }));
    };
    const liveLeague = onboardingLeagueSchema.parse({
      ...ownerLeague,
      liveDraft: { roomId: "room-1", status: "setup" },
    });
    const { client } = renderSection(vi.fn(respond), publishedSeason, liveLeague);
    const user = userEvent.setup();
    expect(screen.queryByLabelText("Draft date and time")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit schedule/iu })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enter draft" }))
      .toHaveAttribute("href", "/leagues/sunday-games/draft");
    await user.click(screen.getByRole("link", { name: "Enter draft" }));
    expect(screen.getByTestId("location"))
      .toHaveTextContent("/leagues/sunday-games/draft");
    await user.click(screen.getByRole("button", { name: "Delete draft" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(await screen.findByRole("button", { name: "Plan live draft" })).toBeVisible();
    expect(client.getQueryState(seasonQueryKeys.onboarding())?.isInvalidated).toBe(true);
    expect(requests).toContain("DELETE /seasons/season-1/live-room");
  });
  it("uses a scheduled time and lets a commissioner cancel archive confirmation", async () => {
    const scheduled = seasonSchema.parse({
      ...publishedSeason, draft: { scheduledAt: "2026-08-30T19:00:00.000Z", timezone: "America/New_York" },
    });
    const liveLeague = onboardingLeagueSchema.parse({
      ...ownerLeague,
      liveDraft: { roomId: "room-live", status: "countdown" },
    });
    renderSection(vi.fn(() => Promise.resolve(jsonResponse({ ok: true }))), scheduled, liveLeague);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete draft" }));
    await user.click(screen.getByRole("button", { name: "Keep draft" }));
    expect(screen.getByRole("button", { name: "Delete draft" })).toBeVisible();
  });
  it("sends an edited scheduled time when creating a room", async () => {
    vi.stubEnv("TZ", "Europe/Rome");
    const scheduled = seasonSchema.parse({
      ...publishedSeason, draft: { scheduledAt: "2026-08-30T19:00:00.000Z" },
    });
    const bodies: string[] = [];
    const respond: PlatformFetch = (_input, init) => {
      bodies.push(typeof init?.body === "string" ? init.body : "");
      return Promise.resolve(jsonResponse({ room: { roomId: "room-2", status: "setup" } }));
    };
    renderSection(vi.fn(respond), scheduled);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Plan live draft" }));
    await user.click(screen.getByRole("button", { name: "Continue to schedule" }));
    const input = screen.getByLabelText("Draft date and time");
    expect(input).toHaveValue("2026-08-30T21:00");
    expect(input).toHaveAccessibleDescription("Times use Europe/Rome. If clocks repeat an hour, new times use the first occurrence.");
    await user.clear(input);
    await user.type(input, "2026-09-01T20:30");
    await user.click(screen.getByRole("button", { name: "Review draft room" }));
    await user.click(screen.getByRole("button", { name: "Create live draft room" }));
    expect(await screen.findByRole("link", { name: "Enter draft" })).toBeVisible();
    expect(JSON.parse(bodies[0] ?? "{}")).toEqual({ startsAt: "2026-09-01T18:30:00.000Z" });
  });
  it("offers snake room setup and reports mutation errors", async () => {
    const errorFetcher: PlatformFetch = vi.fn(() => Promise.resolve(jsonResponse({
      error: { code: "publish_failed", message: "Review setup first." },
    }, 422)));
    const view = renderSection(errorFetcher);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Plan live draft" }));
    await user.click(screen.getByRole("button", { name: "Publish and continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Review setup first.");
    view.unmount();
    render(<MemoryRouter><QueryClientProvider client={new QueryClient()}>
      <LiveRoomSection league={ownerLeague} manageableLeagues={[ownerLeague]} season={snakeSeason} />
    </QueryClientProvider></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Plan live draft" })).toBeVisible();
    expect(screen.queryByText(/support auction drafts only/i)).not.toBeInTheDocument();
  });
  it("reports create and archive failures", async () => {
    const errorFetcher: PlatformFetch = vi.fn(() => Promise.resolve(jsonResponse({
      error: { code: "room_failed", message: "Room unavailable." },
    }, 422)));
    const view = renderSection(errorFetcher, publishedSeason);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Plan live draft" }));
    await user.click(screen.getByRole("button", { name: "Continue to schedule" }));
    await user.type(screen.getByLabelText("Draft date and time"), "2026-09-01T20:30");
    await user.click(screen.getByRole("button", { name: "Review draft room" }));
    await user.click(screen.getByRole("button", { name: "Create live draft room" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Room unavailable.");
    const liveLeague = onboardingLeagueSchema.parse({
      ...ownerLeague,
      liveDraft: { roomId: "room-live", status: "setup" },
    });
    view.unmount();
    renderSection(errorFetcher, publishedSeason, liveLeague);
    await user.click(screen.getByRole("button", { name: "Delete draft" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Room unavailable.");
  });
  it("shows progress for publish, create, and archive requests", async () => {
    const pending = new Promise<Response>(() => undefined);
    const fetcher: PlatformFetch = vi.fn(() => pending);
    const user = userEvent.setup();
    const { unmount: unmountPublish } = renderSection(fetcher);
    await user.click(screen.getByRole("button", { name: "Plan live draft" }));
    await user.click(screen.getByRole("button", { name: "Publish and continue" }));
    expect(screen.getByRole("status")).toHaveTextContent("Publishing league");
    unmountPublish();
    const scheduled = seasonSchema.parse({
      ...publishedSeason,
      draft: { scheduledAt: "2026-08-30T19:00:00.000Z" },
    });
    const { unmount: unmountCreate } = renderSection(fetcher, scheduled);
    await user.click(screen.getByRole("button", { name: "Plan live draft" }));
    await user.click(screen.getByRole("button", { name: "Continue to schedule" }));
    await user.click(screen.getByRole("button", { name: "Review draft room" }));
    await user.click(screen.getByRole("button", { name: "Create live draft room" }));
    expect(screen.getByRole("status")).toHaveTextContent("Creating live room");
    unmountCreate();
    const liveLeague = onboardingLeagueSchema.parse({
      ...ownerLeague,
      liveDraft: { roomId: "room-live", status: "setup" },
    });
    renderSection(fetcher, publishedSeason, liveLeague);
    await user.click(screen.getByRole("button", { name: "Delete draft" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(screen.getByRole("status")).toHaveTextContent("Deleting live draft");
  });
});
