import type { ReactNode } from "react";
import "./LandingStory.css";

interface LandingStoryProps {
  readonly body: string;
  readonly bullets?: readonly string[];
  readonly eyebrow: string;
  readonly heading: string;
  readonly media: ReactNode;
  readonly mediaSide: "left" | "right";
  readonly note?: string;
}

/** One band of the page: a still of the product beside the copy that explains it. */
export const LandingStory = ({
  body,
  bullets,
  eyebrow,
  heading,
  media,
  mediaSide,
  note,
}: LandingStoryProps) =>
  <section aria-label={heading} className={`landing-story landing-story--media-${mediaSide}`}>
    <div className="landing-story__inner">
      <div className="landing-story__media">{media}</div>
      <div className="landing-story__copy">
        <p className="landing-story__eyebrow">{eyebrow}</p>
        <h2>{heading}</h2>
        <p className="landing-story__body">{body}</p>
        {bullets === undefined ? null : <ul className="landing-story__bullets">
          {bullets.map(bullet => <li key={bullet}>{bullet}</li>)}
        </ul>}
        {note === undefined ? null : <p className="landing-story__note">{note}</p>}
      </div>
    </div>
  </section>;
