import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { logout } from "../../../features/auth/api/authApi";
import { leaguePageForPath } from "../../../features/league/lib/leaguePaths";
import { resetAccountQueryState } from "../../../features/auth/model/accountQueryBoundary";
import type { OnboardingLeague } from "../../../shared/api/onboarding/onboardingSchema";
import { Avatar } from "../../../shared/ui/Avatar/Avatar";
import { DropdownMenu, type DropdownMenuItem } from "../../../shared/ui/DropdownMenu/DropdownMenu";
import { navigationTargets } from "../ProductHeader/navigationTargets";
import { AccountMenuIdentity } from "./AccountMenuIdentity";
import type { AccountIdentity } from "./AccountMenuIdentity";
import "./AccountMenu.css";

export type { AccountIdentity } from "./AccountMenuIdentity";

interface AccountMenuProps {
  readonly account: AccountIdentity;
  readonly activeLeague: OnboardingLeague | undefined;
  readonly canManageLeague: boolean;
  readonly leagues: readonly OnboardingLeague[];
  readonly onLeagueChange: (seasonId: string) => void;
}

export const AccountMenu = ({
  account,
  activeLeague,
  canManageLeague,
  leagues,
  onLeagueChange,
}: AccountMenuProps) => {
  const currentPage = leaguePageForPath(useLocation().pathname);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signOut = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await resetAccountQueryState(queryClient);
      void navigate("/login", { replace: true });
    },
  });
  // A laptop shows the league picker in the header, so these repeat it only
  // where that picker is hidden. One league is a label, not a choice, so it
  // carries no marker.
  const leagueItems: DropdownMenuItem[] = leagues.map((league, index) => ({
    // Unheaded, these rows read as commands rather than as the account's leagues.
    ...(index === 0 ? { groupLabel: "Leagues" } : {}),
    hiddenFrom: "laptop",
    label: `${league.leagueName} · ${String(league.seasonYear)}`,
    onSelect: () => { onLeagueChange(league.seasonId); },
    selected: leagues.length > 1 && league.seasonId === activeLeague?.seasonId,
  }));
  // A phone has no room for the header tabs, so this menu carries the pages
  // there. Wider screens keep the tabs and hide these.
  const pageItems: DropdownMenuItem[] = navigationTargets(activeLeague, canManageLeague)
    .map((target, index) => ({
      dividerHiddenFrom: "tablet",
      hiddenFrom: "tablet",
      label: target.label,
      onSelect: () => { void navigate(target.to); },
      selected: target.page === currentPage,
      startsGroup: index === 0 && leagueItems.length > 0,
    }));
  const items: DropdownMenuItem[] = [
    ...leagueItems,
    ...pageItems,
    {
      // The league rows outlast the page rows, so this divider outlasts them too.
      dividerHiddenFrom: leagueItems.length > 0 ? "laptop" : "tablet",
      label: "Account dashboard",
      onSelect: () => { void navigate("/account"); },
      startsGroup: leagueItems.length > 0 || pageItems.length > 0,
    },
    {
      label: "Account settings",
      onSelect: () => { void navigate("/account-settings"); },
    },
    {
      label: "Sync leagues",
      onSelect: () => { void navigate("/connections"); },
    },
    {
      destructive: true,
      disabled: signOut.isPending,
      label: signOut.isPending ? "Signing out..." : "Sign out",
      onSelect: () => { signOut.mutate({}); },
    },
  ];

  return (
    <div className="account-menu">
      <DropdownMenu
        header={<AccountMenuIdentity account={account} />}
        items={items}
        label="Account menu"
      >
        <Avatar
          className="account-menu__avatar"
          {...(account.displayName === undefined ? {} : { displayName: account.displayName })}
          email={account.email}
          seed={account.id}
        />
        <span aria-hidden="true" className="account-menu__menu-icon">
          <Menu size={18} />
        </span>
      </DropdownMenu>
      {signOut.error !== null && (
        <p className="account-menu__error" role="alert">Could not sign out. Try again.</p>
      )}
    </div>
  );
};
