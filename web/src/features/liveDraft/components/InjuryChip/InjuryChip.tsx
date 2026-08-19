import type { LiveDraftAdvisoryInjury } from "../../api/liveDraftAdvisorySchemas";
import { injuryLabel } from "../../lib/liveDraftAdvisory";
import "./InjuryChip.css";

interface InjuryChipProps {
  readonly injury?: LiveDraftAdvisoryInjury | undefined;
}

/**
 * The word carries the warning and the colour only decorates it, so the chip
 * still reads on a monochrome screen. The chip is a real button so a keyboard
 * or a touch screen reaches the headline the same way a pointer does, and a
 * player nobody filed a report about gets no chip rather than an empty one.
 */
export const InjuryChip = ({ injury }: InjuryChipProps) => {
  if (injury === undefined) return null;
  const label = injuryLabel(injury);

  return (
    <span className="injury-chip">
      <button aria-label={label} className="injury-chip__mark" title={label} type="button">
        INJ
      </button>
      <span aria-hidden="true" className="injury-chip__tooltip">{label}</span>
    </span>
  );
};
