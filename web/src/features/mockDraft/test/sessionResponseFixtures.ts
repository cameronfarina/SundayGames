import { auctionMockResponseSchema } from "../api/mockDraftSchemas.js";
import { auctionMockResponseFixture } from "./auctionMockResponseFixture.js";

export const setupMockResponseFixture = () => {
  const base = auctionMockResponseFixture();
  return auctionMockResponseSchema.parse({
    ...base,
    mockSession: { ...base.mockSession, revision: 0, status: "setup" },
    state: {
      ...base.state,
      auctionEvents: [],
      session: {
        ...base.state.session,
        canUndo: false,
        currentNomination: undefined,
        phase: "not_started",
        revision: 0,
        status: "setup",
      },
    },
  });
};

export const readyToCompleteResponseFixture = () => {
  const base = auctionMockResponseFixture();
  return auctionMockResponseSchema.parse({
    ...base,
    state: {
      ...base.state,
      session: {
        ...base.state.session,
        canComplete: true,
        currentNomination: undefined,
        phase: "ready_to_complete",
      },
    },
  });
};

export const awaitingNominationResponseFixture = () => {
  const base = auctionMockResponseFixture();
  return auctionMockResponseSchema.parse({
    ...base,
    state: {
      ...base.state,
      session: {
        ...base.state.session,
        currentNomination: undefined,
        phase: "awaiting_human_nomination",
      },
    },
  });
};
