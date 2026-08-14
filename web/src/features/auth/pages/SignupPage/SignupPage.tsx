import { Link, useLocation } from "react-router-dom";
import { AuthForm } from "../../components/AuthForm/AuthForm";
import { AuthShell } from "../../components/AuthShell/AuthShell";

export const SignupPage = () => {
  const location = useLocation();
  return (
    <AuthShell
      description="Create a league as commissioner, or join one from an invitation."
      footer={<>Already have an account? <Link to={`/login${location.search}`}>Sign in</Link></>}
      title="Create your account"
    >
      <AuthForm mode="signup" />
    </AuthShell>
  );
};
