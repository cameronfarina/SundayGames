import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";
import { invitationSchema } from "../../api/workspaceSchemas";
import { auctionSeason, jsonResponse, requestPath } from "../../test/commissionerFixtures";
import { InvitationSection } from "./InvitationSection";

const pendingInvite = invitationSchema.parse({
  id: "invite-1", seasonId: "season-1", kind: "league", status: "pending",
  expiresAt: "2026-09-01T00:00:00.000Z", acceptPath: "/invitations/invite-1",
});

const renderSection = (
  fetcher: PlatformFetch,
  invitations = [pendingInvite],
  setupStatus: "draft" | "published" = "published",
) => {
  vi.stubGlobal("fetch", fetcher);
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    <InvitationSection invitations={invitations} season={{ ...auctionSeason, setupStatus }} />
  </QueryClientProvider>);
};

describe("InvitationSection", () => {
  afterEach(() => {
    document.body.replaceChildren();
    Reflect.deleteProperty(navigator, "clipboard");
    vi.unstubAllGlobals();
  });

  it("copies the active group link and hides the create button", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    renderSection(vi.fn(() => Promise.resolve(jsonResponse({ invitation: pendingInvite }))));
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    expect(screen.getByText("Sunday Games")).toBeVisible();
    expect(screen.getByText("·")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Copy league invitation" }));
    expect(writeText).toHaveBeenCalledWith("http://localhost:3000/invitations/invite-1");
    expect(screen.getByText("League link copied.")).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create league invitation" })).not.toBeInTheDocument();
  });

  it("selects a manual-copy fallback when clipboard access fails", async () => {
    const writeText = vi.fn(() => Promise.reject(new Error("denied")));
    renderSection(vi.fn(() => Promise.resolve(jsonResponse({ invitation: pendingInvite }))));
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await user.click(screen.getByRole("button", { name: "Copy league invitation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not copy the league invitation.");
    expect(screen.getByRole("textbox", { name: "League invitation link" }))
      .toHaveValue("http://localhost:3000/invitations/invite-1");
    expect(screen.getByRole("textbox", { name: "League invitation link" })).toHaveFocus();
  });

  it("reports API errors when a published league has no pending invitation", async () => {
    const acceptedTeam = invitationSchema.parse({
      ...pendingInvite, id: "team-invite", kind: "team", status: "accepted", acceptPath: undefined,
    });
    const errorFetcher: PlatformFetch = vi.fn(() => Promise.resolve(jsonResponse({
      error: { code: "not_allowed", message: "Only commissioners can invite." },
    }, 403)));
    renderSection(errorFetcher, [acceptedTeam]);
    const user = userEvent.setup();
    expect(screen.queryByLabelText("Shareable league link")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create league invitation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only commissioners can invite.");
  });

  it("shows a copy action after creating an invitation", async () => {
    renderSection(vi.fn(() => Promise.resolve(jsonResponse({ invitation: pendingInvite }))), []);
    await userEvent.setup().click(screen.getByRole("button", { name: "Create league invitation" }));
    expect(await screen.findByRole("button", { name: "Copy league invitation" })).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("publishes a draft league before creating its invitation", async () => {
    const paths: string[] = [];
    const fetcher: PlatformFetch = vi.fn((input: Parameters<PlatformFetch>[0]) => {
      const path = requestPath(input);
      paths.push(path);
      return Promise.resolve(path.endsWith("/publish")
        ? jsonResponse({ season: { ...auctionSeason, setupStatus: "published" } })
        : jsonResponse({ invitation: pendingInvite }));
    });
    renderSection(fetcher, [], "draft");

    await userEvent.setup().click(screen.getByRole("button", { name: "Create and publish league" }));

    expect(await screen.findByRole("button", { name: "Copy league invitation" })).toBeVisible();
    expect(paths).toEqual(["/seasons/season-1/publish", "/invitations"]);
  });

  it("publishes a draft league before exposing its existing invitation", async () => {
    const paths: string[] = [];
    const fetcher: PlatformFetch = vi.fn((input: Parameters<PlatformFetch>[0]) => {
      const path = requestPath(input);
      paths.push(path);
      return Promise.resolve(jsonResponse({
        season: { ...auctionSeason, setupStatus: "published" },
      }));
    });
    renderSection(fetcher, [pendingInvite], "draft");
    const user = userEvent.setup();

    expect(screen.getByRole("button", { name: "Create and publish league" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Copy league invitation" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create and publish league" }));

    expect(await screen.findByRole("button", { name: "Copy league invitation" })).toBeVisible();
    expect(paths).toEqual(["/seasons/season-1/publish"]);
  });

  it("does not republish when invitation creation fails after publishing", async () => {
    const paths: string[] = [];
    const fetcher: PlatformFetch = vi.fn((input: Parameters<PlatformFetch>[0]) => {
      const path = requestPath(input);
      paths.push(path);
      return Promise.resolve(path.endsWith("/publish")
        ? jsonResponse({ season: { ...auctionSeason, setupStatus: "published" } })
        : jsonResponse({
          error: { code: "invitation_failed", message: "Try the invitation again." },
        }, 500));
    });
    renderSection(fetcher, [], "draft");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Create and publish league" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Try the invitation again.");
    await user.click(screen.getByRole("button", { name: "Create league invitation" }));

    expect(paths).toEqual([
      "/seasons/season-1/publish",
      "/invitations",
      "/invitations",
    ]);
  });

  it("keeps the publish action available when publishing fails", async () => {
    const fetcher: PlatformFetch = vi.fn(() => Promise.resolve(jsonResponse({
      error: { code: "publish_failed", message: "Finish league setup before publishing." },
    }, 409)));
    renderSection(fetcher, [pendingInvite], "draft");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Create and publish league" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Finish league setup before publishing.");
    expect(screen.getByRole("button", { name: "Create and publish league" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Copy league invitation" })).not.toBeInTheDocument();
  });

  it("shows invitation progress when the league is already published", async () => {
    const pending = new Promise<Response>(() => undefined);
    renderSection(vi.fn(() => pending), [], "published");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Create league invitation" }));

    expect(screen.getByRole("button", { name: "Creating invitation..." })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Creating league invitation...");
  });

  it("shows progress while creating and publishing", async () => {
    const pending = new Promise<Response>(() => undefined);
    renderSection(vi.fn(() => pending), [], "draft");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Create and publish league" }));
    expect(screen.getByRole("status")).toHaveTextContent("Publishing league");
  });
});
