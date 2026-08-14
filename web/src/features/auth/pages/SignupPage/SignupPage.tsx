import { Link, useLoaderData, useLocation } from "react-router-dom";
import type { SignupConfiguration } from "../../api/authSchemas";
import { AuthForm } from "../../components/AuthForm/AuthForm";
import { AuthShell } from "../../components/AuthShell/AuthShell";

export const SignupPage = () => {
  const location = useLocation();
  const configuration = useLoaderData<SignupConfiguration>();
  return (
    <AuthShell
      description={configuration.passwordRequired
        ? "Create a league as commissioner, or join one from an invitation."
        : "Enter your email and we will send a secure link to finish your account."}
      footer={<>Already have an account? <Link to={`/login${location.search}`}>Sign in</Link></>}
      title="Create your account"
    >
      <AuthForm mode="signup" passwordRequired={configuration.passwordRequired} />
    </AuthShell>
  );
};
