import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { auctionMockResponseFixture } from "../../test/auctionMockResponseFixture.js";
import { completedMockResponseFixture } from "../../test/completedMockResponseFixture.js";
import { renderMockDraft } from "../../test/renderMockDraft.js";
import {
  readyToCompleteResponseFixture,
  setupMockResponseFixture,
} from "../../test/sessionResponseFixtures.js";
import { MockDraftPage } from "./MockDraftPage.js";

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  headers: { "content-type": "application/json" },
  status,
});

describe("MockDraftPage", () => {
  it("creates and starts an auction mock inside the application main region", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse(setupMockResponseFixture(), 201))
      .mockResolvedValueOnce(jsonResponse(auctionMockResponseFixture()));
    const onSessionChange = vi.fn();
    renderMockDraft(
      <MockDraftPage fetcher={fetcher} onSessionChange={onSessionChange} seasonId="season-1" />,
    );

    expect(screen.queryByRole("main")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Create mock draft" }));
    expect(await screen.findByRole("button", { name: "Start draft" })).toBeInTheDocument();
    expect(onSessionChange).toHaveBeenCalledWith("mock-1");
    expect(screen.getAllByText("$136")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Start draft" }));
    expect(await screen.findByRole("heading", { name: "Jahmyr Gibbs" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Available players" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Inspect team roster" })).toBeInTheDocument();
  });

  it("resumes, bids, and abandons a live mock with confirmation", async () => {
    const body = auctionMockResponseFixture();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse(body))
      .mockResolvedValueOnce(jsonResponse(body))
      .mockResolvedValueOnce(jsonResponse({
        mockSession: { ...body.mockSession, status: "abandoned" },
      }));
    renderMockDraft(
      <MockDraftPage fetcher={fetcher} initialSessionId="mock-1" seasonId="season-1" />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Bid $72" }));
    await waitFor(() => { expect(fetcher).toHaveBeenCalledTimes(2); });
    await userEvent.click(screen.getByRole("button", { name: "Abandon mock" }));
    const dialog = screen.getByRole("dialog", { name: "Abandon this mock?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Abandon mock" }));
    expect(await screen.findByText("Mock abandoned")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create mock draft" })).toBeInTheDocument();
  });

  it("finishes a ready session and shows every team's Week 1 results", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse(readyToCompleteResponseFixture()))
      .mockResolvedValueOnce(jsonResponse(completedMockResponseFixture()));
    renderMockDraft(
      <MockDraftPage fetcher={fetcher} initialSessionId="mock-1" seasonId="season-1" />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Finish mock" }));
    expect(await screen.findByRole("heading", { name: "League results" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "1. Short King" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "2. Dart Vader" })).toBeInTheDocument();
  });

  it("shows a safe error when a session cannot be loaded", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ state: "broken" }));
    renderMockDraft(
      <MockDraftPage fetcher={fetcher} initialSessionId="mock-1" seasonId="season-1" />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The server returned data that does not match the application contract.",
    );
  });
});
