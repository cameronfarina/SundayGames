import { AppWindow } from "../AppWindow/AppWindow";
import { BoardPreview } from "../previews/BoardPreview";
import "./ValueShowcase.css";

/** The board is the product. It gets the whole width and the centre of the page. */
export const ValueShowcase = () => <section className="value-showcase">
  <div className="value-showcase__inner">
    <div className="value-showcase__copy">
      <p className="value-showcase__eyebrow">League-specific values</p>
      <h2>See what players are worth here.</h2>
      <p className="value-showcase__body">
        Start with the broader market, then account for your league. Compare market
        pricing, simulated outcomes and your own maximum value in one board, and change
        any number when you disagree.
      </p>
      <p className="value-showcase__note">The market is a reference. Your league sets the price.</p>
    </div>
    <AppWindow activeLabel="Practice"><BoardPreview /></AppWindow>
  </div>
</section>;
