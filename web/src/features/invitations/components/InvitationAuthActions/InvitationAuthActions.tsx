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
        <a className="invite-button invite-button--primary" href={paths.login}>Sign in</a>
        <a className="invite-button" href={paths.signup}>Create account</a>
      </div>
    </section>
  );
}
