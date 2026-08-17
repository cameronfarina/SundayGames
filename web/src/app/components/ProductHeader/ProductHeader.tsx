import { NavLink } from "react-router-dom";
import { useSessionQuery } from "../../../features/auth/api/sessionQuery";
import { leaguePath } from "../../../features/league/lib/leaguePaths";
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
      <div className="product-header__top-row">
        <NavLink
          className="product-header__brand"
          to={activeLeague === undefined ? "/practice" : leaguePath(activeLeague, "practice")}
        >
          Mockd
        </NavLink>
        <div className="product-header__controls">
          <LeaguePicker
            activeLeague={activeLeague}
            leagues={leagues}
            onLeagueChange={setActiveLeague}
          />
          <AccountMenu email={email} />
        </div>
      </div>
      <ProductNavigation
        activeLeague={activeLeague}
        canManageLeague={activeLeague?.canManageLeague === true}
      />
    </header>
  );
};
