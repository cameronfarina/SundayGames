import clsx from "clsx";
import { useId, type ButtonHTMLAttributes } from "react";
import "./ProgressButton.css";

export interface ProgressButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly busy?: boolean;
  readonly percent: number;
}

export const ProgressButton = ({
  busy = false,
  children,
  className,
  disabled = false,
  percent,
  type = "button",
  ...buttonProps
}: ProgressButtonProps) => {
  const labelId = useId();
  const progress = Math.min(100, Math.max(0, Math.round(percent)));

  return (
    <button
      {...buttonProps}
      aria-busy={busy}
      aria-labelledby={labelId}
      className={clsx("progress-button", className)}
      disabled={disabled || busy}
      type={type}
    >
      {busy && (
        <span
          aria-label={`${String(progress)}% complete`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progress}
          className="progress-button__fill"
          role="progressbar"
          style={{ width: `${String(progress)}%` }}
        />
      )}
      <span className="progress-button__label" id={labelId}>{children}</span>
    </button>
  );
};
