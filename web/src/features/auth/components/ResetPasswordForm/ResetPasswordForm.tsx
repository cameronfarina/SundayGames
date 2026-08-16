import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import { resetPassword } from "../../api/authApi";
import { resetAccountQueryState } from "../../model/accountQueryBoundary";
import { authErrorMessage } from "../../model/authErrorMessage";
import { minimumPasswordCharacters } from "../../model/passwordPolicy";
import { PasswordGuidance } from "../PasswordGuidance/PasswordGuidance";
import "../AuthForm/AuthForm.css";

interface ResetPasswordFormProps { readonly token: string }

export const ResetPasswordForm = ({ token }: ResetPasswordFormProps) => {
  const passwordGuidanceId = "reset-password-guidance";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reset = useMutation({
    mutationFn: () => resetPassword({
      newPassword: password,
      newPasswordConfirmation: confirmation,
      token,
    }),
    onSuccess: async () => {
      await resetAccountQueryState(queryClient);
      void navigate("/login?passwordChanged=1", { replace: true });
    },
  });
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    reset.mutate();
  };

  return (
    <form className="auth-form" onSubmit={submit}>
      <div className="auth-form__field">
        <label htmlFor="new-password">New password</label>
        <input
          aria-describedby={passwordGuidanceId}
          autoComplete="new-password"
          disabled={reset.isPending}
          id="new-password"
          minLength={minimumPasswordCharacters}
          onChange={event => { setPassword(event.currentTarget.value); }}
          required
          type="password"
          value={password}
        />
        <PasswordGuidance id={passwordGuidanceId} />
      </div>
      <div className="auth-form__field">
        <label htmlFor="confirm-password">Confirm new password</label>
        <input
          aria-describedby={passwordGuidanceId}
          autoComplete="new-password"
          disabled={reset.isPending}
          id="confirm-password"
          minLength={minimumPasswordCharacters}
          onChange={event => { setConfirmation(event.currentTarget.value); }}
          required
          type="password"
          value={confirmation}
        />
      </div>
      {reset.error !== null && (
        <p className="auth-form__message auth-form__error" role="alert">
          {authErrorMessage(reset.error)}
        </p>
      )}
      <button className="auth-form__submit" disabled={reset.isPending} type="submit">
        {reset.isPending ? "Updating password..." : "Update password"}
      </button>
    </form>
  );
};
