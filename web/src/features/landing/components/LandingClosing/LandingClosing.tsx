import { Link } from "react-router-dom";
import "./LandingClosing.css";

/** The last ask. The page has already made the argument, so it is one button. */
export const LandingClosing = () => <section className="landing-closing">
  <Link className="landing-cta" to="/signup">Connect my league</Link>
</section>;
