import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";
import { onboardingLeagueSchema } from "../../../../shared/api/onboarding/onboardingSchema";
import { seasonSchema } from "../../api/seasonSchemas";
import { auctionSeason, jsonResponse, ownerLeague, requestPath, snakeSeason } from "../../test/commissionerFixtures";
import { LiveRoomSection } from "./LiveRoomSection";

const publishedSeason = seasonSchema.parse({ ...auctionSeason, setupStatus: "published" });

const renderSection = (fetcher: PlatformFetch, season = auctionSeason, league = ownerLeague) => {
  vi.stubGlobal("fetch", fetcher);
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    <LiveRoomSection league={league} season={season} />
  </QueryClientProvider>);
};

describe("LiveRoomSection", () => {
  afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

  it("publishes setup, creates an auction room, enters it, and archives it", async () => {
    const requests: string[] = [];
    const respond: PlatformFetch = (input, init) => {
      requests.push(`${init?.method ?? "GET"} ${requestPath(input)}`);
      if (init?.method === "DELETE") return Promise.resolve(jsonResponse({ ok: true }));
      if (requestPath(input).endsWith("/publish")) {
        return Promise.resolve(jsonResponse({ season: publishedSeason }));
      }
      return Promise.resolve(jsonResponse({ room: { roomId: "room-1", status: "setup" } }));
    };
    renderSection(vi.fn(respond));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Publish reviewed league" }));
    await user.click(await screen.findByRole("button", { name: "Create room" }));
    expect(await screen.findByRole("link", { name: "Enter draft room" }))
      .toHaveAttribute("href", "/draft-room?seasonId=season-1&roomId=room-1");
    await user.click(screen.getByRole("button", { name: "Archive room" }));
    await user.click(screen.getByRole("button", { name: "Confirm archive" }));
    expect(await screen.findByRole("button", { name: "Create room" })).toBeVisible();
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
    await user.click(screen.getByRole("button", { name: "Archive room" }));
    await user.click(screen.getByRole("button", { name: "Keep room" }));
    expect(screen.getByRole("button", { name: "Archive room" })).toBeVisible();
  });

  it("sends an edited scheduled time when creating a room", async () => {
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
    const input = screen.getByLabelText("Draft date and time");
    expect(input).toHaveValue("2026-08-30T19:00");
    await user.clear(input);
    await user.type(input, "2026-09-01T20:30");
    await user.click(screen.getByRole("button", { name: "Create room" }));
    expect(await screen.findByRole("link", { name: "Enter draft room" })).toBeVisible();
    expect(bodies[0]).toContain("startsAt");
  });

  it("shows unsupported snake copy and mutation errors", async () => {
    const errorFetcher: PlatformFetch = vi.fn(() => Promise.resolve(jsonResponse({
      error: { code: "publish_failed", message: "Review setup first." },
    }, 422)));
    const view = renderSection(errorFetcher);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Publish reviewed league" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Review setup first.");
    view.rerender(<QueryClientProvider client={new QueryClient()}>
      <LiveRoomSection league={ownerLeague} season={snakeSeason} />
    </QueryClientProvider>);
    expect(screen.getByText("Hosted live rooms currently support auction drafts only.")).toBeVisible();
  });

  it("reports create and archive failures", async () => {
    const errorFetcher: PlatformFetch = vi.fn(() => Promise.resolve(jsonResponse({
      error: { code: "room_failed", message: "Room unavailable." },
    }, 422)));
    const view = renderSection(errorFetcher, publishedSeason);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Create room" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Room unavailable.");
    const liveLeague = onboardingLeagueSchema.parse({
      ...ownerLeague,
      liveDraft: { roomId: "room-live", status: "setup" },
    });
    view.unmount();
    renderSection(errorFetcher, publishedSeason, liveLeague);
    await user.click(screen.getByRole("button", { name: "Archive room" }));
    await user.click(screen.getByRole("button", { name: "Confirm archive" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Room unavailable.");
  });

  it("shows progress for publish, create, and archive requests", async () => {
    const pending = new Promise<Response>(() => undefined);
    const fetcher: PlatformFetch = vi.fn(() => pending);
    const user = userEvent.setup();
    const { unmount: unmountPublish } = renderSection(fetcher);
    await user.click(screen.getByRole("button", { name: "Publish reviewed league" }));
    expect(screen.getByRole("status")).toHaveTextContent("Publishing league");
    unmountPublish();
    const { unmount: unmountCreate } = renderSection(fetcher, publishedSeason);
    await user.click(screen.getByRole("button", { name: "Create room" }));
    expect(screen.getByRole("status")).toHaveTextContent("Creating live room");
    unmountCreate();
    const liveLeague = onboardingLeagueSchema.parse({
      ...ownerLeague,
      liveDraft: { roomId: "room-live", status: "setup" },
    });
    renderSection(fetcher, publishedSeason, liveLeague);
    await user.click(screen.getByRole("button", { name: "Archive room" }));
    await user.click(screen.getByRole("button", { name: "Confirm archive" }));
    expect(screen.getByRole("status")).toHaveTextContent("Archiving live room");
  });
});
