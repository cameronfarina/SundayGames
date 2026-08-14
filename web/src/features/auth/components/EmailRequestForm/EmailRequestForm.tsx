import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { SyntheticEvent } from "react";
import { requestEmailVerification, requestPasswordReset } from "../../api/authApi";
import { authErrorMessage } from "../../model/authErrorMessage";
import "../AuthForm/AuthForm.css";

type EmailRequestMode = "password" | "verification";

interface EmailRequestFormProps {
  readonly initialEmail?: string;
  readonly mode: EmailRequestMode;
  readonly returnTo?: string;
}

export const EmailRequestForm = ({
  initialEmail = "",
  mode,
  returnTo = "/practice",
}: EmailRequestFormProps) => {
  const [email, setEmail] = useState(initialEmail);
  const request = useMutation({
    mutationFn: () => mode === "verification"
      ? requestEmailVerification({ email, returnTo })
      : requestPasswordReset({ email }),
  });
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    request.mutate();
  };

  return (
    <form className="auth-form" onSubmit={submit}>
      <div className="auth-form__field">
        <label htmlFor="recovery-email">Email</label>
        <input
          autoComplete="email"
          disabled={request.isPending}
          id="recovery-email"
          onChange={event => { setEmail(event.currentTarget.value); }}
          required
          type="email"
          value={email}
        />
      </div>
      {request.data !== undefined && (
        <p className="auth-form__message" role="status">{request.data}</p>
      )}
      {request.error !== null && (
        <p className="auth-form__message auth-form__error" role="alert">
          {authErrorMessage(request.error)}
        </p>
      )}
      <button className="auth-form__submit" disabled={request.isPending} type="submit">
        {request.isPending
          ? "Sending..."
          : mode === "verification" ? "Send verification link" : "Send reset link"}
      </button>
    </form>
  );
};
