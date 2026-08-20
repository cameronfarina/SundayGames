import "./ValueCallout.css";

/**
 * The one comparison the whole product rests on, lifted out of the board so a
 * visitor reads it before they read anything else. The numbers match the board
 * row behind it.
 */
export const ValueCallout = () => <div className="value-callout">
  <p className="value-callout__player">Jahmyr Gibbs</p>
  <dl className="value-callout__rows">
    <div>
      <dt>Market</dt>
      <dd>$57</dd>
    </div>
    <div>
      <dt>Your league</dt>
      <dd>$72</dd>
    </div>
    <div className="value-callout__mine">
      <dt>Your max</dt>
      <dd>$75</dd>
    </div>
  </dl>
</div>;
