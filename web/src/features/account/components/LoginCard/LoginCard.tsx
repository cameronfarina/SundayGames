import type { AuthAccount } from "../../../auth/api/authSchemas";
import { PasswordChangeForm } from "../../../auth/components/PasswordChangeForm/PasswordChangeForm";
import "./LoginCard.css";

export interface LoginCardProps {
  readonly account: AuthAccount;
}

export const LoginCard = ({ account }: LoginCardProps) => (
  <section aria-labelledby="login-heading" className="account-card login-card">
    <h2 className="account-card__heading" id="login-heading">Sign in</h2>
    <dl className="login-card__details">
      <dt>Email</dt>
      <dd>{account.email}</dd>
      <dt>Status</dt>
      <dd>
        {account.emailVerifiedAt === undefined
          ? "Not verified yet"
          : "Verified"}
      </dd>
    </dl>
    <p className="login-card__note">
      Your email is the name you sign in with and cannot be changed here.
    </p>
    <h3 className="login-card__subheading">Change password</h3>
    <p className="login-card__note">
      Changing your password signs you out everywhere, including here.
    </p>
    <PasswordChangeForm />
  </section>
);
