import type { LeagueConnectionStatus } from "../../api/leagueConnectionsSchema";
import { statusPresentation } from "../../lib/connectionStatus";

interface StatusDotProps {
  readonly status: LeagueConnectionStatus;
}

/**
 * The colour is a shortcut, never the message. The dot is a real button so a
 * keyboard or a touch screen can reach the explanation the same way a pointer
 * does, and the tile still prints the status in words beside it.
 */
export const StatusDot = ({ status }: StatusDotProps) => {
  const presentation = statusPresentation(status);
  const explanation = `${presentation.label}: ${presentation.summary}`;

  return <span className="status-dot">
    <button
      aria-label={explanation}
      className={`status-dot__mark status-dot__mark--${presentation.variant}`}
      title={explanation}
      type="button"
    />
    <span aria-hidden="true" className="status-dot__tooltip">{explanation}</span>
  </span>;
};
