import { useSessionQuery } from "../../../features/auth/api/sessionQuery";
import { AccountMenu } from "../AccountMenu/AccountMenu";
import { LeaguePicker } from "./LeaguePicker";
import { ProductNavigation } from "./ProductNavigation";
import { useActiveLeague } from "./hooks/useActiveLeague";
import "./ProductHeader.css";

export const ProductHeader = () => {
  const session = useSessionQuery();
  const { activeLeague, leagues, setActiveLeague } = useActiveLeague();
  const email = session.data?.account.email ?? "";

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
            activeLeague={activeLeague}
            canManageLeague={activeLeague?.canManageLeague === true}
            email={email}
            leagues={leagues}
            onLeagueChange={setActiveLeague}
          />
        </div>
      </div>
    </header>
  );
};
