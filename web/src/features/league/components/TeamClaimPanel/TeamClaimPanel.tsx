import { useState } from "react";
import type { FantasyTeam } from "../../api/leagueSchemas";
import { useClaimLeagueTeam } from "../../hooks/useLeaguePageData";

interface TeamClaimPanelProps {
  readonly seasonId: string;
  readonly teams: readonly FantasyTeam[];
}

export function TeamClaimPanel({ seasonId, teams }: TeamClaimPanelProps) {
  const [teamId, setTeamId] = useState("");
  const claim = useClaimLeagueTeam();
  const selectedTeam = teams.find((team) => team.id === teamId);

  return (
    <section className="league-claim" aria-labelledby="claim-team-title">
      <div>
        <p className="league-eyebrow">One step left</p>
        <h2 id="claim-team-title">Claim your team</h2>
        <p>Select the team you manage. This connects private draft prep to your account.</p>
      </div>
      <fieldset className="league-claim__teams">
        <legend>Available teams</legend>
        {teams.map((team) => (
          <div className="league-claim__team" key={team.id}>
            <input
              aria-label={`${team.displayName} managed by ${team.ownerDisplayName}`}
              checked={teamId === team.id}
              name="league-team"
              type="radio"
              value={team.id}
              onChange={() => {
                setTeamId(team.id);
              }}
            />
            <span><strong>{team.displayName}</strong><small>{team.ownerDisplayName}</small></span>
          </div>
        ))}
      </fieldset>
      {selectedTeam === undefined ? (
        <button className="league-button league-button--primary" disabled type="button">Claim team</button>
      ) : (
        <button
          className="league-button league-button--primary"
          disabled={claim.isPending}
          type="button"
          onClick={() => {
            claim.mutate({ seasonId, ownerId: selectedTeam.ownerId, teamId: selectedTeam.id });
          }}
        >
          {claim.isPending ? "Claiming..." : "Claim team"}
        </button>
      )}
      {claim.error === null ? null : <p role="alert">{claim.error.message}</p>}
    </section>
  );
}
