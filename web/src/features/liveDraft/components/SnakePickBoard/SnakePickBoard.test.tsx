import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SnakePickBoard } from "./SnakePickBoard.js";

const picks = [
  {
    overall: 1,
    round: 1,
    pickInRound: 1,
    teamId: "team-1",
    ownerDisplayName: "Tom",
    teamDisplayName: "Team Tom",
    playerName: "Jahmyr Gibbs",
    source: "pick" as const,
    pickEventId: "pick-1",
  },
  {
    overall: 2,
    round: 1,
    pickInRound: 2,
    teamId: "team-2",
    ownerDisplayName: "Jim",
    teamDisplayName: "Team Jim",
  },
];

describe("SnakePickBoard", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("shows drafted players and the team currently on the clock", () => {
    render(<SnakePickBoard
      canCorrect={false}
      onCorrect={vi.fn()}
      onTheClock={picks[1]}
      picks={picks}
    />);

    expect(screen.getByText("Jahmyr Gibbs")).toBeVisible();
    expect(screen.getByText("On the clock")).toBeVisible();
    expect(screen.getByText("Jim")).toBeVisible();
  });

  it("lets the commissioner correct a native pick", () => {
    const onCorrect = vi.fn();
    vi.spyOn(window, "prompt").mockReturnValue("Puka Nacua");
    render(<SnakePickBoard
      canCorrect
      onCorrect={onCorrect}
      onTheClock={picks[1]}
      picks={picks}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Correct" }));
    expect(onCorrect).toHaveBeenCalledWith("pick-1", "Puka Nacua");
  });
});
