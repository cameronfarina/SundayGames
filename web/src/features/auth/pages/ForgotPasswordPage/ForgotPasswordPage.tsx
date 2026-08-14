import { Link } from "react-router-dom";
import { AuthShell } from "../../components/AuthShell/AuthShell";
import { EmailRequestForm } from "../../components/EmailRequestForm/EmailRequestForm";

export const ForgotPasswordPage = () => (
  <AuthShell
    description="Enter your account email. We will send a reset link if an account exists."
    footer={<>Ready to sign in? <Link to="/login">Back to sign in</Link></>}
    title="Reset your password"
  >
    <EmailRequestForm mode="password" />
  </AuthShell>
);
