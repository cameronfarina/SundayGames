import type { ReactElement, ReactNode } from "react";
import "./EmptyState.css";

export interface EmptyStateProps {
  readonly action?: ReactNode;
  readonly description: string;
  readonly icon?: ReactElement;
  readonly title: string;
}

export const EmptyState = ({ action, description, icon, title }: EmptyStateProps) => (
  <section className="empty-state">
    {icon !== undefined && (
      <span aria-hidden="true" className="empty-state__icon" data-testid="empty-state-icon">{icon}</span>
    )}
    <h2 className="empty-state__title">{title}</h2>
    <p className="empty-state__description">{description}</p>
    {action !== undefined && <div className="empty-state__action">{action}</div>}
  </section>
);
