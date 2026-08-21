import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { logout } from "../../api/authApi";
import { resetAccountQueryState } from "../../model/accountQueryBoundary";
import { authErrorMessage } from "../../model/authErrorMessage";
import { Button, type ButtonVariant } from "../../../../shared/ui/Button/Button";

interface SignOutButtonProps {
  readonly variant?: ButtonVariant;
}

export const SignOutButton = ({ variant }: SignOutButtonProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signOut = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await resetAccountQueryState(queryClient);
      void navigate("/login", { replace: true });
    },
  });

  return (
    <>
      <Button
        disabled={signOut.isPending}
        onClick={() => { signOut.mutate({}); }}
        {...(variant === undefined ? {} : { variant })}
      >
        {signOut.isPending ? "Signing out..." : "Sign out"}
      </Button>
      {signOut.error !== null && <p role="alert">{authErrorMessage(signOut.error)}</p>}
    </>
  );
};
