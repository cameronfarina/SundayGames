import { Link } from "react-router-dom";
import { BrandMark } from "../BrandMark/BrandMark";
import "./LandingFooter.css";

export const LandingFooter = () => <footer className="landing-footer">
  <div className="landing-footer__inner">
    <p className="landing-footer__brand">
      <BrandMark size={22} />
      Sunday Games
    </p>
    <nav aria-label="Footer" className="landing-footer__links">
      <Link to="/login">Log in</Link>
      <Link to="/signup">Sign up</Link>
    </nav>
  </div>
</footer>;
