import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { logout } from "../../../features/auth/api/authApi";
import { PasswordChangeForm } from "../../../features/auth/components/PasswordChangeForm/PasswordChangeForm";
import { resetAccountQueryState } from "../../../features/auth/model/accountQueryBoundary";
import type { OnboardingLeague } from "../../../shared/api/onboarding/onboardingSchema";
import { Dialog } from "../../../shared/ui/Dialog/Dialog";
import { DropdownMenu } from "../../../shared/ui/DropdownMenu/DropdownMenu";
import { leaguePageForPath } from "../../../features/league/lib/leaguePaths";
import { navigationTargets } from "../ProductHeader/navigationTargets";
import { accountInitial } from "./accountInitial";
import "./AccountMenu.css";

interface AccountMenuProps {
  readonly activeLeague: OnboardingLeague | undefined;
  readonly canManageLeague: boolean;
  readonly email: string;
  readonly leagues: readonly OnboardingLeague[];
  readonly onLeagueChange: (seasonId: string) => void;
}

export const AccountMenu = ({
  activeLeague,
  canManageLeague,
  email,
  leagues,
  onLeagueChange,
}: AccountMenuProps) => {
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
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
  // Wide screens show the league picker in the header, so these repeat it only
  // where that picker is hidden.
  const leagueItems = leagues.map(league => ({
    label: `${league.leagueName} · ${String(league.seasonYear)}`,
    narrowOnly: true,
    onSelect: () => { onLeagueChange(league.seasonId); },
    selected: league.seasonId === activeLeague?.seasonId,
  }));
  // A phone has no room for the header tabs, so this menu carries the pages
  // there. Wide screens keep the tabs and hide these.
  const pageItems = navigationTargets(activeLeague, canManageLeague).map((target, index) => ({
    label: target.label,
    narrowOnly: true,
    onSelect: () => { void navigate(target.to); },
    selected: target.page === currentPage,
    startsGroup: index === 0 && leagueItems.length > 0,
  }));
  const items = [
    ...leagueItems,
    ...pageItems,
    {
      label: "Change password",
      onSelect: () => { setPasswordDialogOpen(true); },
      startsGroup: pageItems.length > 0,
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
      <DropdownMenu items={items} label="Account menu">
        <span aria-hidden="true" className="account-menu__initial">
          {accountInitial(email)}
        </span>
        <span aria-hidden="true" className="account-menu__menu-icon">
          <Menu size={18} />
        </span>
      </DropdownMenu>
      <Dialog
        description="Update the password you use to sign in."
        onOpenChange={setPasswordDialogOpen}
        open={passwordDialogOpen}
        title="Change password"
      >
        <PasswordChangeForm />
      </Dialog>
      {signOut.error !== null && (
        <p className="account-menu__error" role="alert">Could not sign out. Try again.</p>
      )}
    </div>
  );
};
