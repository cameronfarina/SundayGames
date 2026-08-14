import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { InvitationAuthActions } from "../../components/InvitationAuthActions/InvitationAuthActions";
import { InvitationError, InvitationLoading } from "../../components/InvitationState/InvitationState";
import { InvitationTeamList } from "../../components/InvitationTeamList/InvitationTeamList";
import { useClaimInvitationTeam, useInvitationPageData } from "../../hooks/useInvitationPageData";
import { leaguePathForInvitation } from "../../lib/invitationPaths";
import "./InvitationPage.css";

export function InvitationPage() {
  const [search] = useSearchParams();
  const token = search.get("token");
  const navigate = useNavigate();
  const data = useInvitationPageData(token);
  const claim = useClaimInvitationTeam();

  if (token === null) return <InvitationError message="This invitation link is missing its token." />;
  if (data.invitation.isPending || data.session.isPending) return <InvitationLoading />;
  if (data.invitation.error !== null) return <InvitationError message={data.invitation.error.message} />;
  if (data.session.error !== null) return <InvitationError message={data.session.error.message} />;

  const details = data.invitation.data;
  const connectedLeague = data.onboarding.data?.leagues.find((league) =>
    league.seasonId === details.invitation.seasonId && league.membership.teamId !== undefined
  );
  const connectedTeamId = connectedLeague?.membership.teamId;
  const joinTeam = (teamId: string) => {
    claim.mutate({ token, teamId }, {
      onSuccess: () => {
        void navigate(leaguePathForInvitation(details.invitation.seasonId));
      },
    });
  };

  return (
    <div className="invite-page">
      <header className="invite-header">
        <p className="invite-eyebrow">League invitation · {details.league.seasonYear}</p>
        <h1>Join {details.league.name}</h1>
        <p>Choose the team you manage. Your selection is linked to your Mockd account.</p>
      </header>
      {data.session.data.status === "signed-out" ? <InvitationAuthActions token={token} /> : null}
      {connectedLeague === undefined ? null : (
        <Link className="invite-button invite-button--primary" to={leaguePathForInvitation(connectedLeague.seasonId)}>
          Open league
        </Link>
      )}
      <InvitationTeamList
        connectedTeamId={connectedTeamId}
        details={details}
        isClaiming={claim.isPending}
        session={data.session.data}
        onClaim={joinTeam}
      />
      {claim.error === null ? null : <p role="alert">{claim.error.message}</p>}
    </div>
  );
}
