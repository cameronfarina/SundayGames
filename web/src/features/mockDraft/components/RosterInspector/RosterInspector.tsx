import { useState } from "react";
import { Select, type SelectOption } from "../../../../shared/ui/index.js";
import type { AuctionTeam, RosterPlayer } from "../../api/auctionBoardSchemas.js";
import { positionAccent } from "../../model/auctionViewModel.js";
import "./RosterInspector.css";

interface RosterInspectorProps {
  readonly humanTeamId: string;
  readonly teams: readonly AuctionTeam[];
}

const rosterOptions = (teams: readonly AuctionTeam[]): readonly SelectOption[] =>
  teams.map(team => ({ label: `${team.name} roster`, value: team.id }));

const rosterPlayerFor = (
  team: AuctionTeam,
  playerId: string | undefined,
): RosterPlayer | undefined => playerId === undefined
  ? undefined
  : team.roster.find(player => player.playerId === playerId);

const RosterFacts = ({ team }: { readonly team: AuctionTeam }) => (
  <dl className="roster-inspector__facts">
    <div><dt>Budget left</dt><dd>${String(team.budgetRemaining)}</dd></div>
    <div><dt>Spent</dt><dd>${String(team.spent)}</dd></div>
    <div><dt>Max bid</dt><dd>${String(team.maxBid)}</dd></div>
  </dl>
);

export const RosterInspector = ({ humanTeamId, teams }: RosterInspectorProps) => {
  const preferredTeam = teams.find(team => team.id === humanTeamId) ?? teams[0];
  const [selectedTeamId, setSelectedTeamId] = useState(preferredTeam?.id ?? "");
  const team = teams.find(candidate => candidate.id === selectedTeamId) ?? preferredTeam;

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
      <RosterFacts team={team} />
      <ol aria-label="Roster slots" className="roster-inspector__slots">
        {team.slots.map(slot => {
          const player = rosterPlayerFor(team, slot.playerId);
          const position = player?.position ?? slot.eligiblePositions[0] ?? slot.slot;
          return (
            <li className={positionAccent(position)} key={slot.slot}>
              <span className="roster-inspector__slot">{slot.slot}</span>
              <span className="roster-inspector__player">
                <strong>{player?.playerName ?? "Open"}</strong>
                {player !== undefined && (
                  <small>
                    ${String(player.price)}
                    {player.source === "keeper" && <span className="roster-inspector__keeper">Keeper</span>}
                  </small>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
