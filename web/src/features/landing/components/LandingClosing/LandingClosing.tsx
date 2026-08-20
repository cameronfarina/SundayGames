import { Link } from "react-router-dom";
import "./LandingClosing.css";

export const LandingClosing = () => <section className="landing-closing">
  <div className="landing-closing__inner">
    <h2>Your draft is coming. Be ready for it.</h2>
    <p>Sunday Games only reads your league. It never sets a lineup or makes a move for you.</p>
    <Link className="landing-cta" to="/signup">Start free</Link>
  </div>
</section>;
