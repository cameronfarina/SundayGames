import { render, screen, within } from "@testing-library/react";
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

const roundRow = (round: number) => screen.getAllByRole("row")[round];

describe("PickBoard", () => {
  afterEach(() => { document.body.replaceChildren(); });

  it("gives every team a column and every round a row", () => {
    render(<PickBoard onTheClock={picks[1]} picks={picks} viewedTeamId="team-Owner11" />);

    expect(screen.getAllByRole("columnheader").map(header => header.textContent))
      .toEqual(["Round", "Owner11", "Owner04"]);
    expect(screen.getAllByRole("rowheader").map(header => header.textContent)).toEqual(["1", "2"]);
    expect(screen.getByText("Ja'Marr Chase")).toBeVisible();
    expect(screen.getByText("On the clock")).toBeVisible();
    expect(screen.getAllByText("-")).toHaveLength(2);
  });

  it("keeps a team's picks in one column when the round reverses", () => {
    render(<PickBoard picks={picks} viewedTeamId="team-Owner11" />);

    const secondRound = roundRow(2);
    if (secondRound === undefined) throw new Error("Expected a row for round 2.");
    expect(within(secondRound).getAllByText(/^\d\.\d\d$/u).map(label => label.textContent))
      .toEqual(["2.02", "2.01"]);
  });

  it("leaves a cell empty when a team has no pick in the round", () => {
    render(<PickBoard picks={[...picks, pick(5, 3, 1, "Owner11")]} />);

    const thirdRound = roundRow(3);
    if (thirdRound === undefined) throw new Error("Expected a row for round 3.");
    expect(within(thirdRound).getAllByRole("cell").at(-1)).toBeEmptyDOMElement();
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
