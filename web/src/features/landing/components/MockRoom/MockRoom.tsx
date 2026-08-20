import { AppWindow } from "../AppWindow/AppWindow";
import { AuctionPreview } from "../previews/AuctionPreview";
import "./MockRoom.css";

interface TendencyRow {
  readonly label: string;
  readonly value: string;
}

/** What the product reads out of one rival's past drafts. */
const tendencyRows: readonly TendencyRow[] = [
  { label: "Targets", value: "Elite WRs" },
  { label: "Historical premium", value: "+14%" },
  { label: "Bidding aggression", value: "High" },
  { label: "Likely to challenge", value: "Puka Nacua & Ja'Marr Chase" },
];

export const MockRoom = () => <section className="mock-room">
  <div className="mock-room__inner">
    <div className="mock-room__copy">
      <p className="mock-room__eyebrow">Realistic mock drafts</p>
      <h2>Your opponents aren’t random. Your mocks shouldn’t be.</h2>
      <p className="mock-room__body">
        Sunday Games simulates the room from your league’s format, settings and draft
        history. It learns how each manager drafts, so the manager who always pays up for
        a star will bid you up in your mock too.
      </p>
      <p className="mock-room__note">Make the expensive mistake in a simulation.</p>
    </div>
    <div className="mock-room__stage">
      <AppWindow><AuctionPreview /></AppWindow>
      <aside className="mock-room__tendency">
        <p className="mock-room__team">Red Zone Rebels</p>
        <dl className="mock-room__rows">
          {tendencyRows.map(row => <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>)}
        </dl>
        <p className="mock-room__source">Example, read from your league’s past drafts.</p>
      </aside>
    </div>
  </div>
</section>;
