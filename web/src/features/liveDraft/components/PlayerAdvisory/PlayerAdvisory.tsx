import { VisuallyHidden } from "../../../../shared/ui";
import type { LiveDraftAdvisoryPlayer } from "../../api/liveDraftAdvisorySchemas";
import { advisorySummary, momentumLabel } from "../../lib/liveDraftAdvisory";
import "./PlayerAdvisory.css";

interface PlayerAdvisoryProps {
  readonly advisory: LiveDraftAdvisoryPlayer | undefined;
}

const momentumMark = (momentum: "rising" | "falling") => momentum === "rising" ? "▲" : "▼";

export const PlayerAdvisory = ({ advisory }: PlayerAdvisoryProps) => {
  if (advisory === undefined) return <span className="player-advisory__absent">--</span>;

  return (
    <span className="player-advisory" title={advisorySummary(advisory)}>
      <span className="player-advisory__rank">{advisory.rankEcr}</span>
      {advisory.tier !== undefined &&
        <span className="player-advisory__tier">T{advisory.tier}</span>}
      {advisory.momentum !== "steady" && <span
        className={`player-advisory__momentum player-advisory__momentum--${advisory.momentum}`}
      >
        <span aria-hidden="true">{momentumMark(advisory.momentum)}</span>
        <VisuallyHidden>{momentumLabel(advisory)}</VisuallyHidden>
      </span>}
    </span>
  );
};
