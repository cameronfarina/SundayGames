import { passwordRequirements } from "../../model/passwordPolicy";

interface PasswordGuidanceProps {
  readonly id: string;
}

export const PasswordGuidance = ({ id }: PasswordGuidanceProps) => (
  <p className="auth-form__hint" id={id}>
    {passwordRequirements}
  </p>
);
