import type { InvitationDetails, InvitationSession } from "../../api/invitationSchemas";

interface InvitationTeamListProps {
  readonly connectedTeamId: string | undefined;
  readonly details: InvitationDetails;
  readonly isClaiming: boolean;
  readonly session: InvitationSession;
  readonly onClaim: (teamId: string) => void;
}

export function InvitationTeamList({
  connectedTeamId,
  details,
  isClaiming,
  session,
  onClaim,
}: InvitationTeamListProps) {
  if (details.teams.length === 0) return <p>No teams are configured for this league.</p>;

  return (
    <ul className="invite-team-list" aria-label="League teams">
      {details.teams.map((team) => {
        const isConnected = team.id === connectedTeamId;
        const canClaim = team.status === "available"
          && connectedTeamId === undefined
          && session.status === "signed-in";
        return (
          <li className="invite-team" key={team.id}>
            <span>
              <strong>{team.name}</strong>
              <small>{team.managerNames?.join(", ") ?? "Manager name not provided"}</small>
            </span>
            {canClaim ? (
              <button
                className="invite-button invite-button--primary"
                disabled={isClaiming}
                type="button"
                onClick={() => {
                  onClaim(team.id);
                }}
              >
                Join as {team.name}
              </button>
            ) : <span className="invite-team__status">{isConnected ? "Your team" : team.status === "claimed" ? "Claimed" : "Available"}</span>}
          </li>
        );
      })}
    </ul>
  );
}
