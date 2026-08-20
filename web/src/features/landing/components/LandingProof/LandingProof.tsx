import "./LandingProof.css";

const capabilities: readonly string[] = [
  "Sleeper and ESPN leagues",
  "Snake and auction drafts",
  "Keeper-aware pricing",
];

export const LandingProof = () => <section className="landing-proof">
  <div className="landing-proof__inner">
    <div>
      <h2>One player. Three different prices.</h2>
      <p className="landing-proof__body">
        Consensus rankings price a player for everyone. Your league prices them for you.
      </p>
      <p className="landing-proof__beat">
        The market’s price. Your league’s price. Your price.
      </p>
      <p className="landing-proof__body">
        Compare consensus value, what your league is likely to pay and the maximum you’re
        willing to spend, all in one place.
      </p>
      <ul className="landing-proof__capabilities">
        {capabilities.map(capability => <li key={capability}>{capability}</li>)}
      </ul>
    </div>
    <figure className="landing-proof__card">
      <figcaption>Puka Nacua · WR</figcaption>
      <dl>
        <div>
          <dt>Market value</dt>
          <dd>$56</dd>
        </div>
        <div>
          <dt>Sunday Funday simulation</dt>
          <dd>$65</dd>
        </div>
        <div className="landing-proof__mine">
          <dt>Your maximum</dt>
          <dd>$67</dd>
        </div>
      </dl>
    </figure>
  </div>
</section>;
