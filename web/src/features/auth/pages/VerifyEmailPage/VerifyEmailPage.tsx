import { Link, useSearchParams } from "react-router-dom";
import { AuthShell } from "../../components/AuthShell/AuthShell";
import { EmailRequestForm } from "../../components/EmailRequestForm/EmailRequestForm";
import { safeReturnPath } from "../../model/authNavigation";

export type VerificationResult =
  | { readonly status: "request" }
  | { readonly status: "verified" }
  | { readonly message: string; readonly status: "error" };

interface VerifyEmailPageProps { readonly result: VerificationResult }

export const VerifyEmailPage = ({ result }: VerifyEmailPageProps) => {
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnPath(searchParams.get("returnTo"));
  return (
    <AuthShell
      description="Open the link from your email, or request a new one."
      footer={<>Ready to sign in? <Link to={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Sign in</Link></>}
      title="Verify your email"
    >
      {result.status === "verified" && (
        <p className="auth-form__message" role="status">Email verified. You can sign in now.</p>
      )}
      {result.status === "error" && (
        <p className="auth-form__message auth-form__error" role="alert">{result.message}</p>
      )}
      {result.status !== "verified" && (
        <EmailRequestForm
          initialEmail={searchParams.get("email") ?? ""}
          mode="verification"
          returnTo={returnTo}
        />
      )}
    </AuthShell>
  );
};
