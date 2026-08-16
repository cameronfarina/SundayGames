import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { FantasyTeam } from "../../api/leagueSchemas";
import { useClaimLeagueTeam } from "../../hooks/useLeaguePageData";

interface TeamClaimPanelProps {
  readonly canManageLeague: boolean;
  readonly seasonId: string;
  readonly teams: readonly FantasyTeam[];
}

export function TeamClaimPanel({ canManageLeague, seasonId, teams }: TeamClaimPanelProps) {
  const [teamId, setTeamId] = useState("");
  const claim = useClaimLeagueTeam();
  const navigate = useNavigate();
  const selectedTeam = teams.find((team) => team.id === teamId);
  const keepersPath = `/commissioner?${new URLSearchParams({ seasonId }).toString()}#keepers`;
  const buttonLabel = selectedTeam === undefined
    ? "Select a team"
    : `Confirm ${selectedTeam.displayName}`;

  const confirmTeam = (team: FantasyTeam) => {
    claim.mutate(
      { seasonId, ownerId: team.ownerId, teamId: team.id },
      {
        onSuccess: () => {
          if (canManageLeague) void navigate(keepersPath);
        },
      },
    );
  };

  return (
    <section className="league-claim" aria-labelledby="claim-team-title">
      <div>
        <p className="league-eyebrow">One step left</p>
        <h2 id="claim-team-title">Claim your team</h2>
        <p>Select the team you manage. This connects private draft prep to your account.</p>
      </div>
      <div className="league-claim__selection">
        <p className="league-claim__label" id="available-teams-title">Available teams</p>
        <div className="league-claim__controls">
          <fieldset aria-labelledby="available-teams-title" className="league-claim__teams">
            {teams.map((team) => (
              <label className="league-claim__team" key={team.id}>
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
              </label>
            ))}
          </fieldset>
          <button
            className="league-button league-button--primary"
            disabled={selectedTeam === undefined || claim.isPending}
            type="button"
            onClick={selectedTeam === undefined ? undefined : () => {
              confirmTeam(selectedTeam);
            }}
          >
            {claim.isPending ? "Claiming team..." : buttonLabel}
          </button>
        </div>
        {claim.error === null ? null : <p role="alert">{claim.error.message}</p>}
      </div>
    </section>
  );
}
