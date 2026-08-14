import clsx from "clsx";
import type { InputHTMLAttributes } from "react";
import "./TextField.css";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> {
  readonly error?: string;
  readonly hint?: string;
  readonly id: string;
  readonly label: string;
}

export const TextField = ({
  className,
  error,
  hint,
  id,
  label,
  ...inputProps
}: TextFieldProps) => {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error === undefined
    ? hint === undefined ? undefined : hintId
    : errorId;

  return (
    <div className="text-field">
      <label className="text-field__label" htmlFor={id}>{label}</label>
      <input
        {...inputProps}
        aria-describedby={describedBy}
        aria-invalid={error !== undefined}
        className={clsx("text-field__input", className)}
        id={id}
        type="text"
      />
      {error === undefined && hint !== undefined && (
        <span className="text-field__hint" id={hintId}>{hint}</span>
      )}
      {error !== undefined && (
        <span className="text-field__error" id={errorId} role="alert">{error}</span>
      )}
    </div>
  );
};
