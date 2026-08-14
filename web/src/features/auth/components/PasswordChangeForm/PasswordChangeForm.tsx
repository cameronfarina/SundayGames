import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import { changePassword } from "../../api/authApi";
import { resetAccountQueryState } from "../../model/accountQueryBoundary";
import { authErrorMessage } from "../../model/authErrorMessage";
import { minimumPasswordCharacters } from "../../model/passwordPolicy";
import "../AuthForm/AuthForm.css";

export const PasswordChangeForm = () => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const change = useMutation({
    mutationFn: () => changePassword({
      currentPassword,
      newPassword,
      newPasswordConfirmation: confirmation,
    }),
    onSuccess: async () => {
      await resetAccountQueryState(queryClient);
      void navigate("/login?passwordChanged=1", { replace: true });
    },
  });
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    change.mutate();
  };

  return (
    <form className="auth-form" onSubmit={submit}>
      <div className="auth-form__field">
        <label htmlFor="current-password">Current password</label>
        <input
          autoComplete="current-password"
          disabled={change.isPending}
          id="current-password"
          onChange={event => { setCurrentPassword(event.currentTarget.value); }}
          required
          type="password"
          value={currentPassword}
        />
      </div>
      <div className="auth-form__field">
        <label htmlFor="changed-password">New password</label>
        <input
          autoComplete="new-password"
          disabled={change.isPending}
          id="changed-password"
          minLength={minimumPasswordCharacters}
          onChange={event => { setNewPassword(event.currentTarget.value); }}
          required
          type="password"
          value={newPassword}
        />
      </div>
      <div className="auth-form__field">
        <label htmlFor="changed-password-confirmation">Confirm new password</label>
        <input
          autoComplete="new-password"
          disabled={change.isPending}
          id="changed-password-confirmation"
          minLength={minimumPasswordCharacters}
          onChange={event => { setConfirmation(event.currentTarget.value); }}
          required
          type="password"
          value={confirmation}
        />
      </div>
      {change.error !== null && (
        <p className="auth-form__message auth-form__error" role="alert">
          {authErrorMessage(change.error)}
        </p>
      )}
      <button className="auth-form__submit" disabled={change.isPending} type="submit">
        {change.isPending ? "Updating password..." : "Update password"}
      </button>
    </form>
  );
};
