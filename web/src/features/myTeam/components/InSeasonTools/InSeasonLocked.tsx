import type { InSeasonView } from "./InSeasonTools";
import "./InSeasonTools.css";

interface InSeasonLockedProps {
  readonly view: InSeasonView;
}

export const InSeasonLocked = ({ view }: InSeasonLockedProps) => (
  <section className="in-season-locked" aria-labelledby="in-season-locked-heading">
    <h2 id="in-season-locked-heading">
      {view === "lineup" ? "Lineup help" : "Waiver wire"} opens after your draft
    </h2>
    <p>{view === "lineup"
      ? "Once your draft ends, this tab ranks your roster against the FantasyPros consensus and flags any starter the experts rate behind your own bench."
      : "Once your draft ends, this tab lists the best players nobody in your league rosters, ranked by FantasyPros."}</p>
    <p>Until then, use Draft prep to build your plan.</p>
  </section>
);
