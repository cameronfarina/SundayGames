import { useState } from "react";
import { Select, type SelectOption } from "../../../../shared/ui/index.js";
import type { SnakeBoardPlayer, SnakeTeam } from "../../api/snakeStateSchemas.js";
import { positionAccent } from "../../model/auctionViewModel.js";
import { playerNamesById } from "../../model/snakeViewModel.js";
import "../RosterInspector/RosterInspector.css";

interface SnakeRosterInspectorProps {
  readonly humanTeamId: string;
  readonly players: readonly SnakeBoardPlayer[];
  readonly teams: readonly SnakeTeam[];
}

const rosterOptions = (teams: readonly SnakeTeam[]): readonly SelectOption[] =>
  teams.map(team => ({ label: `${team.name} roster`, value: team.id }));

export const SnakeRosterInspector = ({
  humanTeamId,
  players,
  teams,
}: SnakeRosterInspectorProps) => {
  const preferredTeam = teams.find(team => team.id === humanTeamId) ?? teams[0];
  const [selectedTeamId, setSelectedTeamId] = useState(preferredTeam?.id ?? "");
  const team = teams.find(candidate => candidate.id === selectedTeamId) ?? preferredTeam;
  const names = playerNamesById(players);
  const positions = new Map(players.map(player => [player.id, player.position]));

  if (team === undefined) {
    return <section className="roster-inspector"><h2>Team rosters</h2><p>No teams available.</p></section>;
  }

  return (
    <section aria-label={`${team.name} roster`} className="roster-inspector">
      <Select
        id="mock-roster-team"
        label="Inspect team roster"
        onValueChange={setSelectedTeamId}
        options={rosterOptions(teams)}
        value={team.id}
      />
      <ol aria-label="Roster slots" className="roster-inspector__slots">
        {team.slots.map(slot => {
          const selection = slot.playerId === undefined
            ? undefined
            : team.roster.find(player => player.playerId === slot.playerId);
          const position = slot.playerId === undefined
            ? slot.eligiblePositions[0] ?? slot.slot
            : positions.get(slot.playerId) ?? slot.slot;
          return (
            <li className={positionAccent(position)} key={slot.slot}>
              <span className="roster-inspector__slot">{slot.slot}</span>
              <span className="roster-inspector__player">
                <strong>
                  {slot.playerId === undefined ? "Open" : names.get(slot.playerId) ?? slot.playerId}
                </strong>
                {selection?.source === "keeper" && (
                  <small><span className="roster-inspector__keeper">Keeper</span></small>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
