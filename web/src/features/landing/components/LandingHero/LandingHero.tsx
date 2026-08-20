import { Link } from "react-router-dom";
import { BoardPreview } from "../previews/BoardPreview";
import { ValueCallout } from "./ValueCallout";
import "./LandingHero.css";

export const LandingHero = () => <section className="landing-hero">
  <div className="landing-hero__inner">
    <div className="landing-hero__copy">
      <p className="landing-hero__eyebrow">Draft prep built for your league</p>
      <h1>Your league isn’t average.<br />So why is your <br />draft prep?</h1>
      <p className="landing-hero__body">
        Sunday Games learns how your league values players and how every manager drafts,
        in order to create custom values, realistic mock drafts and a plan built for the
        room you’ll actually face.
      </p>
      <Link className="landing-cta" to="/signup">Connect my league</Link>
    </div>
    <div className="landing-hero__product">
      <p className="landing-hero__connected">
        <span aria-hidden="true" className="landing-hero__dot" />
        Connected to Sunday Funday
      </p>
      <div className="landing-hero__board">
        <BoardPreview highlight="Jahmyr Gibbs" />
        <ValueCallout />
      </div>
    </div>
  </div>
</section>;
