import { Select } from "../../../../shared/ui";
import type { LiveDraftTeam } from "../../api/liveDraftSchemas";
import { formatDollars } from "../../lib/liveDraftDisplay";
import "./TeamRoster.css";

interface TeamRosterProps {
  readonly onTeamChange: (teamId: string) => void;
  readonly selectedTeamId?: string;
  readonly teams: readonly LiveDraftTeam[];
}

export const TeamRoster = ({ onTeamChange, selectedTeamId, teams }: TeamRosterProps) => {
  const team = teams.find(candidate => candidate.teamId === selectedTeamId) ?? teams[0];
  if (team === undefined) {
    return <section aria-label="Team roster" className="live-panel live-empty">No team rosters are available.</section>;
  }
  const options = teams.map(candidate => ({
    label: `${String(candidate.draftOrderPosition)}. ${candidate.teamDisplayName} · ${candidate.ownerDisplayName}`,
    value: candidate.teamId,
  }));
  const auction = team.budgetRemaining !== undefined;

  return (
    <aside aria-labelledby="live-team-roster-title" className="live-panel team-roster">
      <header className="live-panel__header">
        <h2 id="live-team-roster-title">{team.teamDisplayName} roster</h2>
      </header>
      <div className="team-roster__body">
        <Select
          id="live-team-picker"
          label="View team"
          onValueChange={onTeamChange}
          options={options}
          value={team.teamId}
        />
        <div className="team-roster__metrics">
          {auction && <>
            <span className="team-roster__metric">Budget left<strong>{formatDollars(team.budgetRemaining ?? 0)}</strong></span>
            <span className="team-roster__metric">Spent<strong>{formatDollars(team.spent ?? 0)}</strong></span>
            <span className="team-roster__metric">Max bid<strong>{formatDollars(team.maxBid ?? 0)}</strong></span>
          </>}
          <span className="team-roster__metric">Open slots<strong>{team.rosterSlotsRemaining}</strong></span>
        </div>
        <ol className="team-roster__slots">
          {team.slots.map(slot => {
            const slotTone = slot.slot.replace(/\d+$/u, "").toLowerCase();
            return <li className={`team-roster__slot-row team-roster__slot-row--${slotTone}`} key={slot.slot}>
              <span className={`team-roster__slot position--${slotTone}`}>{slot.slot}</span>
              {slot.player === undefined ? <span className="team-roster__open">Open</span> : <span>
                <strong>{slot.player.name}</strong>
                <small>{auction
                  ? `${formatDollars(slot.player.price)}${slot.player.source === "keeper" ? " · Keeper" : ""}`
                  : slot.player.source === "keeper" || slot.player.source === "imported" ? "Keeper" : "Drafted"}</small>
              </span>}
            </li>;
          })}
        </ol>
      </div>
    </aside>
  );
};
