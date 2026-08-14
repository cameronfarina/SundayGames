import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PracticeSimulationSummary } from "../../api/simulationSchema";
import { SimulationResults } from "./SimulationResults";
import { summary } from "./SimulationResults.testSupport";

const renderTargetOutcomes = (
  targetOutcomes: PracticeSimulationSummary["targetOutcomes"],
) => render(<SimulationResults
  note={undefined}
  onRunChange={vi.fn()}
  pendingRun={false}
  run={undefined}
  selectedRunNumber={1}
  summary={{ ...summary, targetOutcomes }}
/>);

describe("SimulationResults target outcomes", () => {
  it("shows explicit hit and miss statuses with each target rate", () => {
    renderTargetOutcomes([{
      feasible: true,
      hitCount: 2,
      hitRate: 1,
      message: "Jadarian Price met the target constraints in 2/2 runs.",
      playerId: "price",
      playerName: "Jadarian Price",
      status: "hit",
    }, {
      feasible: true,
      hitCount: 1,
      hitRate: 0.5,
      message: "Puka Nacua met the target constraints in 1/2 runs.",
      playerId: "nacua",
      playerName: "Puka Nacua",
      status: "miss",
    }]);

    const outcomes = screen.getByRole("list", { name: "Target outcomes" });
    expect(within(outcomes).getByRole("group", { name: "Hit 100% Jadarian Price" }))
      .toBeInTheDocument();
    expect(within(outcomes).getByRole("group", { name: "Miss 50% Puka Nacua" }))
      .toBeInTheDocument();
  });

  it("shows keeper infeasibilities as unavailable with their backend messages", () => {
    renderTargetOutcomes([{
      feasible: false,
      hitCount: 0,
      hitRate: 0,
      message: "Jadarian Price is retained by Sentinels and cannot be acquired. Choose another target.",
      playerId: "price",
      playerName: "Jadarian Price",
      reason: "retained_by_other_team",
      status: "infeasible",
    }, {
      feasible: false,
      hitCount: 0,
      hitRate: 0,
      message: "Puka Nacua is retained by your team for $55, above the $40 target cap. Raise the cap to at least $55 to satisfy this target.",
      playerId: "nacua",
      playerName: "Puka Nacua",
      reason: "retained_by_your_team_above_max_price",
      status: "infeasible",
    }]);

    const opponentKeeper = screen.getByRole("group", { name: "Unavailable Jadarian Price" });
    expect(within(opponentKeeper).getByText("Jadarian Price is retained by Sentinels and cannot be acquired. Choose another target."))
      .toBeInTheDocument();
    expect(within(opponentKeeper).queryByText("0% Jadarian Price")).not.toBeInTheDocument();

    const ownKeeper = screen.getByRole("group", { name: "Unavailable Puka Nacua" });
    expect(within(ownKeeper).getByText("Puka Nacua is retained by your team for $55, above the $40 target cap. Raise the cap to at least $55 to satisfy this target."))
      .toBeInTheDocument();
    expect(within(ownKeeper).queryByText("0% Puka Nacua")).not.toBeInTheDocument();
  });

  it("uses an infeasibility reason when an optional backend message is absent", () => {
    renderTargetOutcomes([{
      feasible: false,
      hitCount: 0,
      hitRate: 0,
      playerId: "nacua",
      playerName: "Puka Nacua",
      reason: "retained_by_your_team_above_max_price",
      status: "infeasible",
    }]);

    const outcome = screen.getByRole("group", { name: "Unavailable Puka Nacua" });
    expect(within(outcome).getByText("Your keeper price is above the target cap."))
      .toBeInTheDocument();
  });

  it("keeps accessible target names when backend player IDs contain spaces", () => {
    renderTargetOutcomes([{
      feasible: true,
      hitCount: 1,
      hitRate: 0.5,
      playerId: "devon achane",
      playerName: "De'Von Achane",
      status: "miss",
    }]);

    expect(screen.getByRole("group", { name: "Miss 50% De'Von Achane" }))
      .toBeInTheDocument();
  });
});
