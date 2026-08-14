import clsx from "clsx";
import type { InputHTMLAttributes } from "react";
import "./NumberField.css";

export interface NumberFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> {
  readonly error?: string;
  readonly hint?: string;
  readonly id: string;
  readonly label: string;
}

export const NumberField = ({
  className,
  error,
  hint,
  id,
  label,
  ...inputProps
}: NumberFieldProps) => {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error === undefined
    ? hint === undefined ? undefined : hintId
    : errorId;

  return (
    <div className="number-field">
      <label className="number-field__label" htmlFor={id}>{label}</label>
      <input
        {...inputProps}
        aria-describedby={describedBy}
        aria-invalid={error !== undefined}
        className={clsx("number-field__input", className)}
        id={id}
        type="number"
      />
      {error === undefined && hint !== undefined && (
        <span className="number-field__hint" id={hintId}>{hint}</span>
      )}
      {error !== undefined && (
        <span className="number-field__error" id={errorId} role="alert">{error}</span>
      )}
    </div>
  );
};
