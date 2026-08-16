interface PasswordGuidanceProps {
  readonly id: string;
}

export const PasswordGuidance = ({ id }: PasswordGuidanceProps) => (
  <p className="auth-form__hint" id={id}>
    Use at least 15 characters. A passphrase of 4 memorable words works well.
  </p>
);
