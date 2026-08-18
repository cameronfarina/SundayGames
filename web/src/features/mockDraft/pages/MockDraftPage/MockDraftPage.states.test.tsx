import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { auctionMockResponseSchema } from "../../api/mockDraftSchemas.js";
import { auctionMockResponseFixture } from "../../test/auctionMockResponseFixture.js";
import { completedMockResponseFixture } from "../../test/completedMockResponseFixture.js";
import { renderMockDraft } from "../../test/renderMockDraft.js";
import { MockDraftPage } from "./MockDraftPage.js";

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), {
  headers: { "content-type": "application/json" },
  status: 200,
});

describe("MockDraftPage states", () => {
  it("renders the launch state with the platform fetch default", () => {
    renderMockDraft(<MockDraftPage seasonId="season-1" />);
    expect(screen.getByRole("button", { name: "Create mock draft" })).toBeInTheDocument();
  });

  it("shows determinate progress while creating a mock", async () => {
    const fetcher = vi.fn(() => new Promise<Response>(() => undefined));
    renderMockDraft(<MockDraftPage fetcher={fetcher} seasonId="season-1" />);
    await userEvent.click(screen.getByRole("button", { name: "Create mock draft" }));
    expect(screen.getByRole("progressbar", { name: "35% complete" })).toBeInTheDocument();
  });

  it("reports a failed create without leaving the launch state", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: "unavailable", message: "Mock creation is unavailable." },
    }), {
      headers: { "content-type": "application/json" },
      status: 503,
    }));
    renderMockDraft(<MockDraftPage fetcher={fetcher} seasonId="season-1" />);
    await userEvent.click(screen.getByRole("button", { name: "Create mock draft" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Mock creation is unavailable.");
    expect(screen.getByRole("button", { name: "Create mock draft" })).toBeInTheDocument();
  });

  it("shows a loading surface while a saved mock resumes", () => {
    const fetcher = vi.fn(() => new Promise<Response>(() => undefined));
    renderMockDraft(
      <MockDraftPage fetcher={fetcher} initialSessionId="mock-1" seasonId="season-1" />,
    );
    expect(screen.getByLabelText("Mock draft")).toBeInTheDocument();
  });

  it("uses safe copy for a non-error rejection", async () => {
    const fetcher = vi.fn().mockRejectedValue("unreadable failure");
    renderMockDraft(
      <MockDraftPage fetcher={fetcher} initialSessionId="mock-1" seasonId="season-1" />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The mock draft could not be updated.",
    );
  });

  it("warns when a completed response omits its result artifact", async () => {
    const complete = completedMockResponseFixture();
    const response = auctionMockResponseSchema.parse({
      mockSession: complete.mockSession,
      state: complete.state,
    });
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(response));
    renderMockDraft(
      <MockDraftPage fetcher={fetcher} initialSessionId="mock-1" seasonId="season-1" />,
    );
    expect(await screen.findByText("Completed results are unavailable for this mock."))
      .toBeInTheDocument();
  });

  it("keeps the auction usable if the human team is missing from a response", async () => {
    const base = auctionMockResponseFixture();
    const response = auctionMockResponseSchema.parse({
      ...base,
      state: { ...base.state, teams: [base.state.teams[1]] },
    });
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(response));
    renderMockDraft(
      <MockDraftPage fetcher={fetcher} initialSessionId="mock-1" seasonId="season-1" />,
    );
    expect(await screen.findByText("Your max bid $0")).toBeInTheDocument();
  });
});
