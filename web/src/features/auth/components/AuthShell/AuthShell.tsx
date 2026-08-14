import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "./AuthShell.css";

interface AuthShellProps {
  readonly children: ReactNode;
  readonly description: string;
  readonly footer?: ReactNode;
  readonly title: string;
}

export const AuthShell = ({ children, description, footer, title }: AuthShellProps) => (
  <main className="auth-shell">
    <section aria-labelledby="auth-title" className="auth-shell__panel">
      <Link className="auth-shell__brand" to="/practice">Mockd</Link>
      <header className="auth-shell__header">
        <p className="auth-shell__eyebrow">Your draft workspace</p>
        <h1 id="auth-title">{title}</h1>
        <p>{description}</p>
      </header>
      {children}
      {footer !== undefined && <footer className="auth-shell__footer">{footer}</footer>}
    </section>
  </main>
);
