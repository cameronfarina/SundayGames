import { useSessionQuery } from "../../../auth/api/sessionQuery";
import { ConnectedLeaguesCard } from "../../components/ConnectedLeaguesCard/ConnectedLeaguesCard";
import { LoginCard } from "../../components/LoginCard/LoginCard";
import { ProfileCard } from "../../components/ProfileCard/ProfileCard";
import "./AccountSettingsPage.css";

export const AccountSettingsPage = () => {
  const session = useSessionQuery();
  const account = session.data?.account;

  return (
    <section aria-labelledby="account-settings-title" className="account-settings">
      <header className="account-settings__header">
        <p>Account</p>
        <h1 id="account-settings-title">Account settings</h1>
        <span>Your profile, how you sign in, and the leagues Sunday Games syncs for you.</span>
      </header>
      {account === undefined
        ? <p role="status">Loading your account...</p>
        : (
          <div className="account-settings__cards">
            <ProfileCard account={account} />
            <LoginCard account={account} />
            <ConnectedLeaguesCard />
          </div>
        )}
    </section>
  );
};
