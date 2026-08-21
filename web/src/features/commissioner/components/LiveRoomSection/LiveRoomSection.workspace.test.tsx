import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";
import { onboardingLeagueSchema } from "../../../../shared/api/onboarding/onboardingSchema";
import { seasonQueryKeys } from "../../../../shared/api/queries/seasonQueryKeys";
import { seasonSchema } from "../../api/seasonSchemas";
import {
  auctionSeason,
  jsonResponse,
  ownerLeague,
  requestPath,
} from "../../test/commissionerFixtures";
import { LiveRoomSection } from "./LiveRoomSection";

const publishedSeason = seasonSchema.parse({ ...auctionSeason, setupStatus: "published" });

const renderWorkspace = (
  fetcher: PlatformFetch,
  season = auctionSeason,
  league = ownerLeague,
  manageableLeagues = [league],
) => {
  vi.stubGlobal("fetch", fetcher);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(seasonQueryKeys.onboarding(), { leagues: [] });
  client.setQueryData(seasonQueryKeys.leagueSeason(season.id), { season });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <LiveRoomSection league={league} manageableLeagues={manageableLeagues} season={season} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
};

describe("LiveRoomSection workspace", () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("shows manageable scheduled drafts in chronological order and the selected league status", () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-08-21T12:00:00.000Z");
    vi.stubEnv("TZ", "Europe/Rome");
    const selectedLeague = onboardingLeagueSchema.parse({
      ...ownerLeague,
      nextDraftAt: "2026-08-30T19:00:00.000Z",
    });
    const laterLeague = onboardingLeagueSchema.parse({
      ...ownerLeague,
      leagueId: "league-2",
      leagueName: "Later League",
      leagueSlug: "later-league",
      nextDraftAt: "2026-09-02T23:00:00.000Z",
      seasonId: "season-2",
    });
    const earlierLeague = onboardingLeagueSchema.parse({
      ...ownerLeague,
      leagueId: "league-3",
      leagueName: "Earlier League",
      leagueSlug: "earlier-league",
      nextDraftAt: "2026-08-29T18:00:00.000Z",
      seasonId: "season-3",
    });
    const memberLeague = onboardingLeagueSchema.parse({
      ...ownerLeague,
      canManageLeague: false,
      leagueId: "league-4",
      leagueName: "Member League",
      leagueSlug: "member-league",
      membership: { role: "member" },
      nextDraftAt: "2026-08-28T18:00:00.000Z",
      seasonId: "season-4",
    });
    const completedSchedule = onboardingLeagueSchema.parse({
      ...ownerLeague,
      leagueId: "league-5",
      leagueName: "Past League",
      leagueSlug: "past-league",
      nextDraftAt: "2026-08-20T18:00:00.000Z",
      seasonId: "season-5",
    });
    const scheduledSeason = seasonSchema.parse({
      ...publishedSeason,
      draft: { scheduledAt: selectedLeague.nextDraftAt, timezone: "America/New_York" },
    });

    renderWorkspace(
      vi.fn(),
      scheduledSeason,
      selectedLeague,
      [laterLeague, completedSchedule, memberLeague, selectedLeague, earlierLeague],
    );

    const selectedDetails = screen.getByLabelText("Selected league draft details");
    expect(within(selectedDetails).getByText("Upcoming draft:")).toBeVisible();
    expect(within(selectedDetails).getByText("Europe/Rome")).toBeVisible();
    expect(within(selectedDetails).getByText((_content, element) =>
      element?.getAttribute("datetime") === "2026-08-30T19:00:00.000Z"
    ))
      .toHaveAttribute("datetime", "2026-08-30T19:00:00.000Z");
    expect(screen.getByLabelText("Other upcoming drafts")).not.toHaveTextContent("Sunday Games");
    expect(screen.getAllByRole("listitem").map(item => item.textContent)).toEqual([
      expect.stringContaining("Earlier League"),
      expect.stringContaining("Later League"),
    ]);
    expect(screen.queryByRole("list", { name: "Upcoming scheduled drafts" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Earlier League" }))
      .toHaveAttribute("href", "/leagues/earlier-league/commissioner?section=live-draft");
  });

  it("shows a live room's status instead of its old schedule", () => {
    renderWorkspace(
      vi.fn(),
      publishedSeason,
      onboardingLeagueSchema.parse({
        ...ownerLeague,
        liveDraft: { roomId: "room-1", status: "live" },
        nextDraftAt: "2026-08-30T17:00:00.000Z",
      }),
    );

    const selectedDetails = screen.getByLabelText("Selected league draft details");
    expect(within(selectedDetails).getByText("Draft status:")).toBeVisible();
    expect(within(selectedDetails).getByText("Live")).toBeVisible();
    expect(within(selectedDetails).queryByText("Upcoming draft:")).not.toBeInTheDocument();
  });

  it("does not describe a past scheduled time as upcoming", () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-08-21T12:00:00.000Z");
    renderWorkspace(
      vi.fn(),
      publishedSeason,
      onboardingLeagueSchema.parse({
        ...ownerLeague,
        nextDraftAt: "2025-08-30T17:00:00.000Z",
      }),
    );

    const selectedDetails = screen.getByLabelText("Selected league draft details");
    expect(within(selectedDetails).getByText("Draft scheduled for:")).toBeVisible();
    expect(within(selectedDetails).queryByText("Upcoming draft:")).not.toBeInTheDocument();
  });

  it("guides a commissioner through readiness, scheduling, and confirmation", async () => {
    vi.stubEnv("TZ", "Europe/Rome");
    const requests: { readonly body: string; readonly path: string }[] = [];
    const respond: PlatformFetch = (input, init) => {
      requests.push({
        body: typeof init?.body === "string" ? init.body : "",
        path: requestPath(input),
      });
      if (requestPath(input).endsWith("/publish")) {
        return Promise.resolve(jsonResponse({ season: publishedSeason }));
      }
      return Promise.resolve(jsonResponse({
        room: {
          roomId: "room-1",
          startsAt: "2026-09-01T18:30:00.000Z",
          status: "countdown",
        },
      }));
    };
    renderWorkspace(vi.fn(respond));
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Plan live draft" }));
    expect(screen.getByRole("dialog", { name: "Prepare live draft" })).toHaveTextContent("Step 1 of 3");
    await user.click(screen.getByRole("button", { name: "Publish and continue" }));
    expect(await screen.findByText("Step 2 of 3")).toBeVisible();

    const input = screen.getByLabelText("Draft date and time");
    expect(input).toHaveAccessibleDescription(/Europe\/Rome/u);
    await user.type(input, "2026-09-01T20:30");
    await user.click(screen.getByRole("button", { name: "Review draft room" }));
    expect(screen.getByText("Step 3 of 3")).toBeVisible();
    expect(screen.getByText((_content, element) =>
      element?.getAttribute("datetime") === "2026-09-01T18:30:00.000Z"
    ))
      .toHaveAttribute("datetime", "2026-09-01T18:30:00.000Z");
    await user.click(screen.getByRole("button", { name: "Create live draft room" }));

    expect(await screen.findByRole("link", { name: "Enter draft" })).toBeVisible();
    expect(requests.map(request => request.path)).toEqual([
      "/seasons/season-1/publish",
      "/seasons/season-1/live-room",
    ]);
    expect(JSON.parse(requests[1]?.body ?? "{}")).toEqual({
      startsAt: "2026-09-01T18:30:00.000Z",
    });
  });

  it("falls back to the browser timezone when the stored timezone is invalid", () => {
    vi.stubEnv("TZ", "Europe/Rome");
    const scheduledLeague = onboardingLeagueSchema.parse({
      ...ownerLeague,
      nextDraftAt: "2026-08-30T19:00:00.000Z",
    });
    const invalidTimezoneSeason = seasonSchema.parse({
      ...publishedSeason,
      draft: { scheduledAt: scheduledLeague.nextDraftAt, timezone: "Not/AZone" },
    });

    renderWorkspace(vi.fn(), invalidTimezoneSeason, scheduledLeague);

    expect(screen.getByLabelText("Selected league draft details")).toHaveTextContent("Europe/Rome");
  });

  it("keeps the commissioner on the schedule step when the local time does not exist", async () => {
    vi.stubEnv("TZ", "Europe/Rome");
    renderWorkspace(vi.fn(), publishedSeason);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Plan live draft" }));
    await user.click(screen.getByRole("button", { name: "Continue to schedule" }));
    const input = screen.getByLabelText("Draft date and time");
    await user.type(input, "2026-03-29T02:30");
    await user.click(screen.getByRole("button", { name: "Review draft room" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "That time does not exist in Europe/Rome because the clocks change. Choose another time.",
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(/That time does not exist in Europe\/Rome/u);
    expect(screen.getByText("Step 2 of 3")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Close dialog" }));
  });

  it("keeps the wizard closed when a dismissed publish finishes", async () => {
    let finishPublish: (response: Response) => void = () => undefined;
    const pendingPublish = new Promise<Response>((resolve) => { finishPublish = resolve; });
    renderWorkspace(vi.fn(() => pendingPublish));
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Plan live draft" }));
    await user.click(screen.getByRole("button", { name: "Publish and continue" }));
    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    await act(async () => {
      finishPublish(jsonResponse({ season: publishedSeason }));
      await pendingPublish;
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
