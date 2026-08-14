import type { ReactNode } from "react";
import "./VisuallyHidden.css";

export interface VisuallyHiddenProps {
  readonly children: ReactNode;
}

export const VisuallyHidden = ({ children }: VisuallyHiddenProps) => (
  <span className="visually-hidden">{children}</span>
);
