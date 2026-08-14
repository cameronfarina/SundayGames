import { NavLink } from "react-router-dom";
import { useSessionQuery } from "../../../features/auth/api/sessionQuery";
import { AccountMenu } from "../AccountMenu/AccountMenu";
import { LeaguePicker } from "./LeaguePicker";
import { ProductNavigation } from "./ProductNavigation";
import { useActiveLeague } from "./hooks/useActiveLeague";
import "./ProductHeader.css";

export const ProductHeader = () => {
  const session = useSessionQuery();
  const { activeLeague, leagues, navigationSearch, setActiveLeague } = useActiveLeague();
  const search = navigationSearch.length > 0 ? `?${navigationSearch}` : "";
  const email = session.data?.account.email ?? "";

  return (
    <header className="product-header">
      <div className="product-header__top-row">
        <NavLink className="product-header__brand" to={{ pathname: "/practice", search }}>
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
        canManageLeague={activeLeague?.canManageLeague === true}
        search={search}
      />
    </header>
  );
};
