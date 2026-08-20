import { Star } from "lucide-react";
import { boardPreviewRows, positionFilters } from "./previewData";
import "./BoardPreview.css";

/** A phone has no room for "Simulation", so the heading shortens with the screen. */
const ColumnLabel = ({ full, short }: { readonly full: string; readonly short: string }) => <>
  <span className="board-preview__label-full">{full}</span>
  <span className="board-preview__label-short">{short}</span>
</>;

const valueClassName = (targeted: boolean): string =>
  targeted
    ? "board-preview__value board-preview__value--mine"
    : "board-preview__value";

export const BoardPreview = () => <div className="board-preview">
  <div className="board-preview__heading">
    <div>
      <p className="board-preview__eyebrow">Player board</p>
      <h3>Available players</h3>
    </div>
    <p className="board-preview__count">50 shown / 500 matching</p>
  </div>
  <ul className="board-preview__filters">
    {positionFilters.map(filter => <li
      aria-current={filter === "All"}
      className={filter === "All"
        ? "board-preview__filter board-preview__filter--selected"
        : "board-preview__filter"}
      key={filter}
    >{filter}</li>)}
  </ul>
  <div className="board-preview__table-wrap">
    <table>
      <thead>
        <tr>
          <th className="board-preview__target-column">Target</th>
          <th className="board-preview__rank-column">Rank</th>
          <th className="board-preview__player-column">Player</th>
          <th className="board-preview__position-column">Pos</th>
          <th>Market</th>
          <th><ColumnLabel full="Simulation" short="Sim" /></th>
          <th><ColumnLabel full="My value" short="Mine" /></th>
        </tr>
      </thead>
      <tbody>
        {boardPreviewRows.map(row => <tr
          className={`board-preview__row board-preview__row--${row.position.toLowerCase()}`}
          key={row.name}
        >
          <td className="board-preview__target-column">
            <span className={row.targeted
              ? "board-preview__star board-preview__star--on"
              : "board-preview__star"}
            >
              <Star aria-hidden="true" fill={row.targeted ? "currentColor" : "none"} size={17} />
            </span>
          </td>
          <td className="board-preview__rank-column">{row.rank}</td>
          <td className="board-preview__player-column board-preview__name">{row.name}</td>
          <td className="board-preview__position-column">
            <span className="board-preview__position">{row.position}</span>
          </td>
          <td>${row.market}</td>
          <td>${row.simulation}</td>
          <td>
            <span className="board-preview__money">
              <span aria-hidden="true">$</span>
              <span className={valueClassName(row.targeted)}>{row.mine}</span>
            </span>
          </td>
        </tr>)}
      </tbody>
    </table>
  </div>
</div>;
