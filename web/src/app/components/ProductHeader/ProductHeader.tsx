import { useSessionQuery } from "../../../features/auth/api/sessionQuery";
import { AccountMenu, type AccountIdentity } from "../AccountMenu/AccountMenu";
import { LeaguePicker } from "./LeaguePicker";
import { ProductNavigation } from "./ProductNavigation";
import { useActiveLeague } from "./hooks/useActiveLeague";
import "./ProductHeader.css";

export const ProductHeader = () => {
  const session = useSessionQuery();
  const { activeLeague, leagues, setActiveLeague } = useActiveLeague();
  const account = session.data?.account;
  const identity: AccountIdentity = {
    email: account?.email ?? "",
    id: account?.id ?? "",
    ...(account?.displayName === undefined ? {} : { displayName: account.displayName }),
  };

  return (
    <header className="product-header">
      <div className="product-header__bar">
        <ProductNavigation
          activeLeague={activeLeague}
          canManageLeague={activeLeague?.canManageLeague === true}
        />
        <div className="product-header__controls">
          <LeaguePicker
            activeLeague={activeLeague}
            leagues={leagues}
            onLeagueChange={setActiveLeague}
          />
          <AccountMenu
            account={identity}
            activeLeague={activeLeague}
            canManageLeague={activeLeague?.canManageLeague === true}
            leagues={leagues}
            onLeagueChange={setActiveLeague}
          />
        </div>
      </div>
    </header>
  );
};
