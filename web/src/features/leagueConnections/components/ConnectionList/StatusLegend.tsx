import { useState } from "react";
import { statusLegend } from "../../lib/connectionStatus";

/**
 * A dot tooltip only ever explains the colour it is on. This spells out all
 * four, and it opens on a tap as readily as on a pointer.
 */
export const StatusLegend = () => {
  const [open, setOpen] = useState(false);

  return <div className="status-legend">
    <button
      aria-expanded={open}
      className="status-legend__toggle"
      onClick={() => { setOpen(current => !current); }}
      type="button"
    >What do the colours mean?</button>
    {open
      ? <dl className="status-legend__entries">
        {statusLegend.map(entry => <div key={entry.status}>
          <dt>
            <span
              aria-hidden="true"
              className={`status-dot__mark status-dot__mark--${entry.variant}`}
            />
            {entry.label}
          </dt>
          <dd>{entry.summary}</dd>
        </div>)}
      </dl>
      : null}
  </div>;
};
