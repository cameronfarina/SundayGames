import { Trash2 } from "lucide-react";
import { targetPreviewRows } from "./previewData";
import "./TargetsPreview.css";

const bidClassName = (highlighted: boolean): string =>
  highlighted
    ? "targets-preview__money targets-preview__money--focused"
    : "targets-preview__money";

export const TargetsPreview = () => <div className="targets-preview">
  <div className="targets-preview__heading">
    <p className="targets-preview__eyebrow">Simulation plan</p>
    <h3>Draft targets</h3>
  </div>
  <ol className="targets-preview__list">
    {targetPreviewRows.map(target => <li className="targets-preview__row" key={target.name}>
      <div className="targets-preview__player">
        <strong>{target.name}</strong>
        <span>{target.position}</span>
      </div>
      <div className="targets-preview__controls">
        <span className="targets-preview__field">
          <span className="targets-preview__label">Maximum bid</span>
          <span className={bidClassName(target.highlighted)}>${target.maximumBid}</span>
        </span>
        <span className="targets-preview__button">Save</span>
        <span className="targets-preview__button">
          <Trash2 aria-hidden="true" size={17} />
          <span className="sr-only">Remove {target.name}</span>
        </span>
      </div>
    </li>)}
  </ol>
</div>;
