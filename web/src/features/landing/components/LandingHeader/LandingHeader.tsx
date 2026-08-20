import { Link } from "react-router-dom";
import { BrandMark } from "../BrandMark/BrandMark";
import "./LandingHeader.css";

export const LandingHeader = () => <header className="landing-header">
  <div className="landing-header__inner">
    <p className="landing-header__brand">
      <BrandMark size={30} />
      Sunday Games
    </p>
    <nav aria-label="Account" className="landing-header__actions">
      <Link className="landing-header__login" to="/login">Log in</Link>
      <Link className="landing-cta landing-cta--compact" to="/signup">Start free</Link>
    </nav>
  </div>
</header>;
