import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { SyntheticEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PlatformApiError } from "../../../../shared/api/http/PlatformApiError";
import { createAccount, login } from "../../api/authApi";
import { resetAccountQueryState } from "../../model/accountQueryBoundary";
import { authErrorMessage } from "../../model/authErrorMessage";
import { invitationTokenFromReturnTo, safeReturnPath } from "../../model/authNavigation";
import "./AuthForm.css";

export type AuthFormMode = "login" | "signup";

interface AuthFormProps { readonly mode: AuthFormMode }
type AuthOutcome = { readonly kind: "authenticated" } | {
  readonly kind: "notice";
  readonly message: string;
};

export const AuthForm = ({ mode }: AuthFormProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const returnTo = safeReturnPath(searchParams.get("returnTo"));
  const loginAndCacheSession = async (): Promise<void> => {
    const authenticated = await login({ email, password });
    await resetAccountQueryState(queryClient, { account: authenticated.account });
  };

  const authentication = useMutation({
    mutationFn: async (): Promise<AuthOutcome> => {
      if (mode === "login") {
        await loginAndCacheSession();
        return { kind: "authenticated" };
      }
      const invitationToken = invitationTokenFromReturnTo(returnTo);
      const signup = await createAccount({
        email,
        ...(invitationToken === undefined ? {} : { invitationToken }),
        password,
        returnTo,
      });
      if ("account" in signup) {
        await loginAndCacheSession();
        return { kind: "authenticated" };
      }
      return { kind: "notice", message: signup.message };
    },
    onSuccess: result => {
      if (result.kind === "authenticated") void navigate(returnTo, { replace: true });
      else setNotice(result.message);
    },
  });

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(undefined);
    authentication.mutate();
  };
  const error = authentication.error;
  const verificationLink = error instanceof PlatformApiError && error.code === "email_unverified"
    ? `/verify-email?email=${encodeURIComponent(email)}&returnTo=${encodeURIComponent(returnTo)}`
    : undefined;

  return (
    <form className="auth-form" onSubmit={submit}>
      <div className="auth-form__field">
        <label htmlFor="auth-email">Email</label>
        <input
          autoComplete="email"
          disabled={authentication.isPending}
          id="auth-email"
          name="email"
          onChange={event => { setEmail(event.currentTarget.value); }}
          required
          type="email"
          value={email}
        />
      </div>
      <div className="auth-form__field">
        <label htmlFor="auth-password">Password</label>
        <input
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          disabled={authentication.isPending}
          id="auth-password"
          minLength={8}
          name="password"
          onChange={event => { setPassword(event.currentTarget.value); }}
          required
          type="password"
          value={password}
        />
      </div>
      {notice !== undefined && <p className="auth-form__message" role="status">{notice}</p>}
      {error !== null && (
        <p className="auth-form__message auth-form__error" role="alert">
          {authErrorMessage(error)}
          {verificationLink !== undefined && <Link to={verificationLink}>Resend verification</Link>}
        </p>
      )}
      <button className="auth-form__submit" disabled={authentication.isPending} type="submit">
        {authentication.isPending
          ? mode === "signup" ? "Creating account..." : "Signing in..."
          : mode === "signup" ? "Create account" : "Sign in"}
      </button>
    </form>
  );
};
