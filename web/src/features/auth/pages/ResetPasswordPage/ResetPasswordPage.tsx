import { Link, useSearchParams } from "react-router-dom";
import { AuthShell } from "../../components/AuthShell/AuthShell";
import { ResetPasswordForm } from "../../components/ResetPasswordForm/ResetPasswordForm";

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  return (
    <AuthShell
      description="Choose a new password for your Mockd account."
      footer={<>Ready to sign in? <Link to="/login">Back to sign in</Link></>}
      title="Choose a new password"
    >
      {token === null
        ? <p className="auth-form__message auth-form__error" role="alert">This reset link is missing its token.</p>
        : <ResetPasswordForm token={token} />}
    </AuthShell>
  );
};
