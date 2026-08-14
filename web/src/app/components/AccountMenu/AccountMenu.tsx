import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../../../features/auth/api/authApi";
import { PasswordChangeForm } from "../../../features/auth/components/PasswordChangeForm/PasswordChangeForm";
import { resetAccountQueryState } from "../../../features/auth/model/accountQueryBoundary";
import { authErrorMessage } from "../../../features/auth/model/authErrorMessage";
import { Dialog } from "../../../shared/ui/Dialog/Dialog";
import { DropdownMenu } from "../../../shared/ui/DropdownMenu/DropdownMenu";
import { accountInitials } from "./accountInitials";
import "./AccountMenu.css";

interface AccountMenuProps {
  readonly email: string;
}

export const AccountMenu = ({ email }: AccountMenuProps) => {
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signOut = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await resetAccountQueryState(queryClient);
      void navigate("/login", { replace: true });
    },
  });
  const items = [
    { label: "Change password", onSelect: () => { setPasswordDialogOpen(true); } },
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
        <span aria-hidden="true" className="account-menu__initials">
          {accountInitials(email)}
        </span>
      </DropdownMenu>
      <Dialog
        description="Update the password used to sign in to Mockd."
        onOpenChange={setPasswordDialogOpen}
        open={passwordDialogOpen}
        title="Change password"
      >
        <PasswordChangeForm />
      </Dialog>
      {signOut.error !== null && (
        <p className="account-menu__error" role="alert">{authErrorMessage(signOut.error)}</p>
      )}
    </div>
  );
};
