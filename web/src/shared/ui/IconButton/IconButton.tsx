import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./IconButton.css";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  readonly children: ReactNode;
  readonly label: string;
}

export const IconButton = ({
  children,
  className,
  label,
  type = "button",
  ...buttonProps
}: IconButtonProps) => (
    <span className="icon-button-wrap">
      <button
        {...buttonProps}
        aria-label={label}
        className={clsx("icon-button", className)}
        title={label}
        type={type}
      >
        {children}
      </button>
      <span aria-hidden="true" className="icon-button__tooltip">{label}</span>
    </span>
);
