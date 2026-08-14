import { Link } from "react-router-dom";
import { invitationAuthPaths } from "../../lib/invitationPaths";

export function InvitationAuthActions({ token }: { readonly token: string }) {
  const paths = invitationAuthPaths(token);
  return (
    <section className="invite-auth" aria-labelledby="invite-auth-title">
      <div>
        <h2 id="invite-auth-title">Connect your account</h2>
        <p>Sign in or create an account, then choose the team you manage.</p>
      </div>
      <div className="invite-actions">
        <Link className="invite-button invite-button--primary" to={paths.login}>Sign in</Link>
        <Link className="invite-button" to={paths.signup}>Create account</Link>
      </div>
    </section>
  );
}
