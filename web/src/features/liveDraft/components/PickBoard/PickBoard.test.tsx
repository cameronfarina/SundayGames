import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { liveDraftPickSchema } from "../../api/liveDraftSchemas";
import { pickLabel } from "../../lib/pickLabel";
import { PickBoard } from "./PickBoard";

const pick = (overall: number, round: number, pickInRound: number, owner: string, playerName?: string) =>
  liveDraftPickSchema.parse({
    overall,
    round,
    pickInRound,
    teamId: `team-${owner}`,
    ownerDisplayName: owner,
    teamDisplayName: `${owner} Team`,
    ...(playerName === undefined ? {} : { playerName, source: "sale" }),
  });

const picks = [
  pick(1, 1, 1, "Owner11", "Ja'Marr Chase"),
  pick(2, 1, 2, "Owner04"),
  pick(3, 2, 1, "Owner04"),
  pick(4, 2, 2, "Owner11"),
];

const keeperPick = liveDraftPickSchema.parse({
  overall: 1,
  round: 1,
  pickInRound: 1,
  teamId: "team-Owner11",
  ownerDisplayName: "Owner11",
  teamDisplayName: "Owner11 Team",
  playerName: "De'Von Achane",
  source: "keeper",
});

describe("PickBoard", () => {
  afterEach(() => { document.body.replaceChildren(); });

  it("groups picks by round and names the team on the clock", () => {
    render(<PickBoard onTheClock={picks[1]} picks={picks} viewedTeamId="team-Owner11" />);

    expect(screen.getByText("Round 1")).toBeVisible();
    expect(screen.getByText("Round 2")).toBeVisible();
    expect(screen.getByText("Ja'Marr Chase")).toBeVisible();
    expect(screen.getByText("On the clock")).toBeVisible();
    expect(screen.getAllByText("-")).toHaveLength(2);
  });

  it("writes a pick the way managers say it", () => {
    const first = picks[0];
    if (first === undefined) throw new Error("Expected a fixture pick.");
    expect(pickLabel(first)).toBe("1.01");
  });

  it("marks a keeper pick apart from a drafted one", () => {
    render(<PickBoard picks={[keeperPick]} viewedTeamId="team-Owner11" />);

    expect(screen.getByText("De'Von Achane")).toBeVisible();
  });

  it("renders without a team on the clock or a viewed team", () => {
    render(<PickBoard picks={picks} />);

    expect(screen.getByRole("heading", { name: "Draft board" })).toBeVisible();
    expect(screen.getAllByText("-")).toHaveLength(3);
  });
});
