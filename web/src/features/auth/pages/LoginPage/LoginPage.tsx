import { Link, useLocation, useSearchParams } from "react-router-dom";
import { AuthForm } from "../../components/AuthForm/AuthForm";
import { AuthShell } from "../../components/AuthShell/AuthShell";

export const LoginPage = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  return (
    <AuthShell
      description="Open your leagues, practice plans, and live auction rooms."
      footer={<>New to Mockd? <Link to={`/signup${location.search}`}>Create account</Link></>}
      title="Sign in"
    >
      {searchParams.get("passwordChanged") === "1" && (
        <p className="auth-form__message" role="status">
          Password changed. Sign in with your new password.
        </p>
      )}
      <AuthForm mode="login" />
      <p><Link to="/forgot-password">Forgot password?</Link></p>
    </AuthShell>
  );
};
