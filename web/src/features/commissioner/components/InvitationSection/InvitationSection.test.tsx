import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";
import { invitationSchema } from "../../api/workspaceSchemas";
import { jsonResponse } from "../../test/commissionerFixtures";
import { InvitationSection } from "./InvitationSection";

const pendingInvite = invitationSchema.parse({
  id: "invite-1", seasonId: "season-1", kind: "league", status: "pending",
  expiresAt: "2026-09-01T00:00:00.000Z", acceptPath: "/invitations/invite-1",
});

const renderSection = (fetcher: PlatformFetch, invitations = [pendingInvite]) => {
  vi.stubGlobal("fetch", fetcher);
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    <InvitationSection invitations={invitations} seasonId="season-1" />
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
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(writeText).toHaveBeenCalledWith("http://localhost:3000/invitations/invite-1");
    expect(screen.getByText("League link copied.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Create league link" })).not.toBeInTheDocument();
  });

  it("selects the link when clipboard access fails", async () => {
    const writeText = vi.fn(() => Promise.reject(new Error("denied")));
    renderSection(vi.fn(() => Promise.resolve(jsonResponse({ invitation: pendingInvite }))));
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(await screen.findByText("Copy the selected link.")).toBeVisible();
    expect(screen.getByLabelText("Shareable league link")).toHaveFocus();
  });

  it("creates a link and reports API errors when no pending league link exists", async () => {
    const acceptedTeam = invitationSchema.parse({
      ...pendingInvite, id: "team-invite", kind: "team", status: "accepted", acceptPath: undefined,
    });
    const errorFetcher: PlatformFetch = vi.fn(() => Promise.resolve(jsonResponse({
      error: { code: "not_allowed", message: "Only commissioners can invite." },
    }, 403)));
    renderSection(errorFetcher, [acceptedTeam]);
    const user = userEvent.setup();
    expect(screen.queryByLabelText("Shareable league link")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create league link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only commissioners can invite.");
  });

  it("shows the new link after creating one", async () => {
    renderSection(vi.fn(() => Promise.resolve(jsonResponse({ invitation: pendingInvite }))), []);
    await userEvent.setup().click(screen.getByRole("button", { name: "Create league link" }));
    expect(await screen.findByDisplayValue("http://localhost:3000/invitations/invite-1")).toBeVisible();
  });

  it("shows progress while creating a group link", async () => {
    const pending = new Promise<Response>(() => undefined);
    renderSection(vi.fn(() => pending), []);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Create league link" }));
    expect(screen.getByRole("status")).toHaveTextContent("Creating league link");
  });
});
