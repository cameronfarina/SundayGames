interface PasswordGuidanceProps {
  readonly id: string;
}

export const PasswordGuidance = ({ id }: PasswordGuidanceProps) => (
  <p className="auth-form__hint" id={id}>
    Use at least 6 characters.
  </p>
);
