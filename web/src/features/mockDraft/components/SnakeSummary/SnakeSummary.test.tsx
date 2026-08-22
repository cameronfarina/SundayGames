import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { snakeMockResponseFixture } from "../../test/snakeMockResponseFixture.js";
import { SnakeSummary } from "./SnakeSummary.js";

const { state } = snakeMockResponseFixture();

describe("SnakeSummary", () => {
  afterEach(() => { document.body.replaceChildren(); });

  it("reports progress, who is up, and the open slots left", () => {
    render(<SnakeSummary state={state} />);

    expect(screen.getByText("Active")).toBeVisible();
    expect(screen.getByText("1 / 4 picked")).toBeVisible();
    expect(screen.getByText("Short King")).toBeVisible();
    expect(screen.getByText("1.02")).toBeVisible();
    expect(screen.getByText("Your draft pick")).toBeVisible();
    expect(screen.getByText("2 of 2")).toBeVisible();
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
  });

  it("dashes the clock and the slot count before a team is claimed", () => {
    render(<SnakeSummary state={{
      ...state,
      session: { ...state.session, currentPick: undefined, humanTeamId: "team-unclaimed" },
    }} />);

    expect(screen.getByLabelText("Your draft pick: -")).toBeVisible();
    expect(screen.getByLabelText("On the clock: -")).toBeVisible();
  });
});
