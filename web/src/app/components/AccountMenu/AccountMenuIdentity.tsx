import { Avatar } from "../../../shared/ui/Avatar/Avatar";
import "./AccountMenuIdentity.css";

export interface AccountIdentity {
  readonly displayName?: string;
  readonly email: string;
  readonly id: string;
}

export interface AccountMenuIdentityProps {
  readonly account: AccountIdentity;
}

export const AccountMenuIdentity = ({ account }: AccountMenuIdentityProps) => {
  const named = account.displayName?.trim() ?? "";

  return (
    <div className="account-menu-identity">
      <Avatar
        {...(account.displayName === undefined ? {} : { displayName: account.displayName })}
        email={account.email}
        seed={account.id}
        size="sm"
      />
      <div className="account-menu-identity__text">
        {/* Without a display name the email is the identity, so it leads rather
            than sitting under a name derived from it. */}
        <strong className="account-menu-identity__name">
          {named.length > 0 ? named : account.email}
        </strong>
        {named.length > 0 && (
          <span className="account-menu-identity__email">{account.email}</span>
        )}
      </div>
    </div>
  );
};
