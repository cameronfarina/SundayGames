import type { SyntheticEvent } from "react";
import { Trash2 } from "lucide-react";
import type { PracticeShortlistItem } from "../../api/practiceContextSchema";
import "./ShortlistPanel.css";

interface ShortlistPanelProps {
  readonly draftFormat?: "auction" | "snake";
  readonly items: readonly PracticeShortlistItem[];
  readonly onRemove: (item: PracticeShortlistItem) => void;
  readonly onSave: (item: PracticeShortlistItem, maxBid: number | undefined) => void;
  readonly pending: boolean;
}

interface TargetRowProps extends Omit<ShortlistPanelProps, "items"> {
  readonly item: PracticeShortlistItem;
}

function TargetRow({ draftFormat = "auction", item, onRemove, onSave, pending }: TargetRowProps) {
  const submit = (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault();
    const rawValue = new FormData(event.currentTarget).get("maxBid");
    const maxBid = typeof rawValue === "string" && rawValue.trim().length > 0
      ? Number(rawValue)
      : undefined;
    onSave(item, maxBid);
  };

  return (
    <li className="shortlist-row">
      <div><strong>{item.playerName}</strong><span>{item.position}</span></div>
      {draftFormat === "snake" ? <div className="shortlist-row__snake-actions">
        <span>Prioritized when available at one of your picks.</span>
        <button aria-label={`Remove ${item.playerName}`} disabled={pending} onClick={() => { onRemove(item); }} type="button">
          <Trash2 aria-hidden="true" size={17} />
        </button>
      </div> : <form onSubmit={submit}>
        <label><span>Maximum bid for {item.playerName}</span><span className="shortlist-row__money">$<input
          aria-label={`Maximum bid for ${item.playerName}`}
          defaultValue={item.maxBid}
          disabled={pending}
          key={item.maxBid ?? "uncapped"}
          min="0"
          name="maxBid"
          step="1"
          type="number"
        /></span></label>
        <button aria-label={`Save ${item.playerName} maximum bid`} disabled={pending} type="submit">Save</button>
        <button aria-label={`Remove ${item.playerName}`} disabled={pending} onClick={() => { onRemove(item); }} type="button">
          <Trash2 aria-hidden="true" size={17} />
        </button>
      </form>}
    </li>
  );
}

export function ShortlistPanel({ draftFormat = "auction", items, onRemove, onSave, pending }: ShortlistPanelProps) {
  return (
    <section aria-labelledby="draft-plan-title" className="shortlist-panel">
      <div className="shortlist-panel__heading"><p className="practice-eyebrow">Simulation plan</p><h2 id="draft-plan-title">Draft targets</h2></div>
      {items.length === 0
        ? <p className="practice-empty">Star players on the board to build this plan.</p>
        : <ol>{items.map(item => <TargetRow
            item={item}
            key={item.id}
            draftFormat={draftFormat}
            onRemove={onRemove}
            onSave={onSave}
            pending={pending}
          />)}</ol>}
    </section>
  );
}
