import type { AuctionState } from "../../api/auctionStateSchemas.js";
import { auctionProgress } from "../../model/auctionViewModel.js";
import "./MockSummary.css";

interface MockSummaryProps {
  readonly state: AuctionState;
}

const titleCase = (value: string): string => value
  .split("_")
  .map(word => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
  .join(" ");

export const MockSummary = ({ state }: MockSummaryProps) => {
  const humanTeam = state.teams.find(team => team.id === state.session.humanTeamId);
  const progress = auctionProgress(state.teams);
  const stats = [
    { label: "Status", value: titleCase(state.session.status) },
    { label: "Progress", value: `${String(progress.completed)} / ${String(progress.total)} rostered` },
    { label: "Budget left", value: humanTeam === undefined ? "-" : `$${String(humanTeam.budgetRemaining)}` },
    { label: "Spent", value: humanTeam === undefined ? "-" : `$${String(humanTeam.spent)}` },
    { label: "Open slots", value: humanTeam === undefined ? "-" : String(humanTeam.rosterSlotsRemaining) },
    { label: "Max bid", value: humanTeam === undefined ? "-" : `$${String(humanTeam.maxBid)}` },
  ];

  return (
    <dl className="mock-summary">
      {stats.map(stat => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}
    </dl>
  );
};
