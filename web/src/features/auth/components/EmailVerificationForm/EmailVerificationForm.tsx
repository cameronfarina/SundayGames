import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import { verifyEmail } from "../../api/authApi";
import { authErrorMessage } from "../../model/authErrorMessage";
import { minimumPasswordCharacters } from "../../model/passwordPolicy";
import { EmailRequestForm } from "../EmailRequestForm/EmailRequestForm";
import { PasswordGuidance } from "../PasswordGuidance/PasswordGuidance";
import "../AuthForm/AuthForm.css";

interface EmailVerificationFormProps {
  readonly initialEmail: string;
  readonly returnTo: string;
  readonly token: string;
}

export const EmailVerificationForm = ({
  initialEmail,
  returnTo,
  token,
}: EmailVerificationFormProps) => {
  const passwordGuidanceId = "verification-password-guidance";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const navigate = useNavigate();
  const verification = useMutation({
    mutationFn: () => verifyEmail({
      token,
      newPassword: password,
      newPasswordConfirmation: confirmation,
    }),
    onSuccess: () => {
      const query = new URLSearchParams({ emailVerified: "1", returnTo });
      void navigate(`/login?${query.toString()}`, { replace: true });
    },
  });
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    verification.mutate();
  };

  return (
    <>
      <form className="auth-form" onSubmit={submit}>
        <div className="auth-form__field">
          <label htmlFor="verification-password">Choose password</label>
          <input
            aria-describedby={passwordGuidanceId}
            autoComplete="new-password"
            disabled={verification.isPending}
            id="verification-password"
            minLength={minimumPasswordCharacters}
            onChange={event => { setPassword(event.currentTarget.value); }}
            required
            type="password"
            value={password}
          />
          <PasswordGuidance id={passwordGuidanceId} />
        </div>
        <div className="auth-form__field">
          <label htmlFor="verification-confirmation">Confirm password</label>
          <input
            aria-describedby={passwordGuidanceId}
            autoComplete="new-password"
            disabled={verification.isPending}
            id="verification-confirmation"
            minLength={minimumPasswordCharacters}
            onChange={event => { setConfirmation(event.currentTarget.value); }}
            required
            type="password"
            value={confirmation}
          />
        </div>
        {verification.error !== null && (
          <p className="auth-form__message auth-form__error" role="alert">
            {authErrorMessage(verification.error)}
          </p>
        )}
        <button className="auth-form__submit" disabled={verification.isPending} type="submit">
          {verification.isPending ? "Finishing account..." : "Finish account"}
        </button>
      </form>
      {verification.error !== null && (
        <EmailRequestForm initialEmail={initialEmail} mode="verification" returnTo={returnTo} />
      )}
    </>
  );
};
