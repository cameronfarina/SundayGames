import type { SnakeState } from "../../api/snakeStateSchemas.js";
import { pickLabel } from "../../model/snakeViewModel.js";
import "../MockSummary/MockSummary.css";

interface SnakeSummaryProps {
  readonly state: SnakeState;
}

const titleCase = (value: string): string => value
  .split("_")
  .map(word => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
  .join(" ");

export const SnakeSummary = ({ state }: SnakeSummaryProps) => {
  const humanTeam = state.teams.find(team => team.id === state.session.humanTeamId);
  const made = state.board.picks.filter(pick => pick.selection !== undefined).length;
  const current = state.session.currentPick;
  const currentPick = current === undefined
    ? undefined
    : state.board.picks.find(pick => pick.overall === current.overall);
  const openSlots = humanTeam?.slots.filter(slot => slot.playerId === undefined).length;
  const stats = [
    { label: "Status", value: titleCase(state.session.status) },
    { label: "Progress", value: `${String(made)} / ${String(state.board.picks.length)} picked` },
    { label: "On the clock", value: currentPick === undefined ? "-" : currentPick.teamName },
    { label: "Pick", value: currentPick === undefined ? "-" : pickLabel(currentPick) },
    { label: "Rounds", value: String(state.session.rounds) },
    { label: "Open slots", value: openSlots === undefined ? "-" : String(openSlots) },
  ];

  return (
    <dl className="mock-summary">
      {stats.map(stat => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}
    </dl>
  );
};
