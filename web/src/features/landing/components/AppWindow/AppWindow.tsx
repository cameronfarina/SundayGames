import type { ReactNode } from "react";
import "./AppWindow.css";

/**
 * The product's own tabs, written out as plain text. This is a still of the
 * app, so nothing here navigates anywhere.
 */
const navigationLabels: readonly string[] = [
  "Practice",
  "Player news",
  "League",
  "My team",
  "Commissioner",
];

const tabClassName = (active: boolean): string =>
  active ? "app-window__tab app-window__tab--active" : "app-window__tab";

interface AppWindowProps {
  /** Tab to underline, when the still is taken from one of the product's tabs. */
  readonly activeLabel?: string;
  readonly children: ReactNode;
}

/** A browser window around a still, so it reads as a screen from the product. */
export const AppWindow = ({ activeLabel, children }: AppWindowProps) =>
  <div className="app-window">
    <div aria-hidden="true" className="app-window__chrome">
      <span className="app-window__dots" />
      <span className="app-window__address">sundaygames.io</span>
    </div>
    <div aria-hidden="true" className="app-window__nav">
      <ul className="app-window__tabs">
        {navigationLabels.map(label => <li
          className={tabClassName(label === activeLabel)}
          key={label}
        >{label}</li>)}
      </ul>
      <span className="app-window__league">Sunday Funday · 2026</span>
    </div>
    <div className="app-window__body">{children}</div>
  </div>;
