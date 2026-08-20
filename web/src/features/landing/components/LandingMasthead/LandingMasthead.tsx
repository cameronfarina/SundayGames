import { Link } from "react-router-dom";
import heroBoard from "../../assets/hero-board.jpg";
import "./LandingMasthead.css";

export const LandingMasthead = () => <section className="landing-masthead">
  <img alt="" className="landing-masthead__backdrop" src={heroBoard} />
  <div className="landing-masthead__scrim" />
  <div className="landing-masthead__inner">
    <h1>Win your draft before it starts.</h1>
    <p>Price every player. Rehearse the room. Set your ceiling. Draft day should be boring.</p>
    <Link className="landing-cta" to="/signup">Start free</Link>
  </div>
</section>;
