import { Link, useSearchParams } from "react-router-dom";
import { AuthShell } from "../../components/AuthShell/AuthShell";
import { EmailVerificationForm } from "../../components/EmailVerificationForm/EmailVerificationForm";
import { EmailRequestForm } from "../../components/EmailRequestForm/EmailRequestForm";
import { safeReturnPath } from "../../model/authNavigation";

export type VerificationResult =
  | { readonly status: "request" }
  | { readonly status: "setup"; readonly token: string };

interface VerifyEmailPageProps { readonly result: VerificationResult }

export const VerifyEmailPage = ({ result }: VerifyEmailPageProps) => {
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnPath(searchParams.get("returnTo"));
  return (
    <AuthShell
      description="Choose your password to finish creating your account."
      footer={<>Ready to sign in? <Link to={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Sign in</Link></>}
      title="Verify your email"
    >
      {result.status === "setup" ? (
        <EmailVerificationForm
          initialEmail={searchParams.get("email") ?? ""}
          returnTo={returnTo}
          token={result.token}
        />
      ) : (
        <EmailRequestForm
          initialEmail={searchParams.get("email") ?? ""}
          mode="verification"
          returnTo={returnTo}
        />
      )}
    </AuthShell>
  );
};
