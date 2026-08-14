import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";
import "./Button.css";

export type ButtonVariant = "primary" | "secondary" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly fullWidth?: boolean;
  readonly variant?: ButtonVariant;
}

export const Button = ({
  className,
  fullWidth = false,
  type = "button",
  variant = "primary",
  ...buttonProps
}: ButtonProps) => (
  <button
    {...buttonProps}
    className={clsx(
      "button",
      `button--${variant}`,
      fullWidth && "button--full-width",
      className,
    )}
    type={type}
  />
);
