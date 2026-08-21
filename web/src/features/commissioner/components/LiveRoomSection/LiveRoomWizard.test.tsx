import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";
import { seasonQueryKeys } from "../../../../shared/api/queries/seasonQueryKeys";
import { seasonSchema } from "../../api/seasonSchemas";
import { auctionSeason, jsonResponse, requestPath } from "../../test/commissionerFixtures";
import { LiveRoomWizard } from "./LiveRoomWizard";

const publishedSeason = seasonSchema.parse({ ...auctionSeason, setupStatus: "published" });

describe("LiveRoomWizard", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("reviews a local draft time before creating the room", async () => {
    vi.stubEnv("TZ", "Europe/Rome");
    const requests: string[] = [];
    const respond: PlatformFetch = (input, init) => {
      requests.push(typeof init?.body === "string" ? init.body : requestPath(input));
      return Promise.resolve(jsonResponse({
        room: {
          roomId: "room-1",
          startsAt: "2026-09-01T18:30:00.000Z",
          status: "countdown",
        },
      }));
    };
    const fetcher = vi.fn(respond);
    vi.stubGlobal("fetch", fetcher);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    client.setQueryData(seasonQueryKeys.onboarding(), { leagues: [] });
    const onRoomCreated = vi.fn();
    render(<QueryClientProvider client={client}>
      <LiveRoomWizard
        initialStartsAt={undefined}
        leagueName="Sunday Games"
        onPublished={vi.fn()}
        onRoomCreated={onRoomCreated}
        published
        season={publishedSeason}
        timeZone="Europe/Rome"
      />
    </QueryClientProvider>);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Plan live draft" }));
    await user.click(screen.getByRole("button", { name: "Continue to schedule" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Step 1 of 3")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Continue to schedule" }));
    await user.type(screen.getByLabelText("Draft date and time"), "2026-09-01T20:30");
    await user.click(screen.getByRole("button", { name: "Review draft room" }));
    expect(screen.getByText("Step 3 of 3")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("Draft date and time")).toHaveValue("2026-09-01T20:30");
    await user.click(screen.getByRole("button", { name: "Review draft room" }));
    await user.click(screen.getByRole("button", { name: "Create live draft room" }));

    expect(onRoomCreated).toHaveBeenCalledWith(expect.objectContaining({ roomId: "room-1" }));
    expect(JSON.parse(requests[0] ?? "{}")).toEqual({ startsAt: "2026-09-01T18:30:00.000Z" });
  });
});
