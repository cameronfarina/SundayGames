import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { logout } from "../../api/authApi";
import { authErrorMessage } from "../../model/authErrorMessage";

export const SignOutButton = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signOut = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      void navigate("/login", { replace: true });
    },
  });

  return (
    <>
      <button disabled={signOut.isPending} onClick={() => { signOut.mutate({}); }} type="button">
        {signOut.isPending ? "Signing out..." : "Sign out"}
      </button>
      {signOut.error !== null && <p role="alert">{authErrorMessage(signOut.error)}</p>}
    </>
  );
};
