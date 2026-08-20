import { useEffect, useState } from "react";
import { firstTourStop, tourStops } from "./tourStops";
import "./ProductTour.css";

export const ProductTour = () => {
  const [active, setActive] = useState(firstTourStop);

  /* Only the opening screen blocks the first paint. The other four are fetched
     once the page is up, so changing tabs shows the screen straight away
     instead of downloading it while a visitor waits. */
  useEffect(() => {
    for (const stop of tourStops) {
      const screen = new Image();
      screen.src = stop.image;
    }
  }, []);

  return <section className="product-tour" id="product-tour">
    <div className="product-tour__inner">
      <div className="product-tour__heading">
        <h2>From league history to the final pick.</h2>
      </div>
      <div className="product-tour__tabs" role="tablist">
        {tourStops.map(stop => <button
          aria-selected={stop.label === active.label}
          className="product-tour__tab"
          key={stop.label}
          onClick={() => { setActive(stop); }}
          role="tab"
          type="button"
        >{stop.label}</button>)}
      </div>
      <div className="product-tour__frame">
        <div className="product-tour__chrome">
          <span className="product-tour__dots" />
          <span className="product-tour__address">sundaygames.io</span>
        </div>
        <img alt={active.alt} src={active.image} />
      </div>
    </div>
  </section>;
};
