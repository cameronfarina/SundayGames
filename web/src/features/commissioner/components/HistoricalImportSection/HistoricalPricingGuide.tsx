import { Button, Dialog } from "../../../../shared/ui/index.js";

export function HistoricalPricingGuide() {
  return <>
    <p className="commissioner-help history-pricing__intro">
      Import previous auction results to teach Sunday Games how your league values players.
      Historical sale prices improve your league-specific projections. When owner names are
      included—and they match the manager or team names on the Overview tab—Sunday Games uses
      their bidding history to create more realistic mock drafts.
    </p>
    <h3>What can I upload?</h3>
    <div className="history-pricing__formats">
      <div>
        <strong>Complete draft results</strong>
        <code>Owner | Player | Position | Price</code>
        <p>Best option. Models both league pricing and individual manager tendencies.</p>
      </div>
      <div>
        <strong>Ranked price sheets</strong>
        <code>Rank | Player | Position | Price</code>
        <p>
          Use historical rankings or value sheets when owner-level draft results are unavailable.
          Rank is the player&apos;s rank within the listed position.
        </p>
      </div>
    </div>
    <p className="commissioner-help">
      Upload one CSV, TSV, or XLSX file per season. You can also include <code>Public Value</code> to
      compare your league&apos;s sale prices with that season&apos;s market.
    </p>
    <div className="history-pricing__links">
      <a
        className="commissioner-button"
        download="sunday-games-auction-history-template.csv"
        href="/sunday-games-auction-history-template.csv"
      >
        Download a template
      </a>
      <Dialog
        title="Historical pricing formats"
        trigger={<Button variant="secondary">View formatting examples</Button>}
      >
        <div className="history-pricing__examples">
          <strong>Complete draft results</strong>
          <code>Owner,Player,Position,Price,Public Value</code>
          <code>Example Team,Jahmyr Gibbs,RB,75,68</code>
          <strong>Ranked price sheet</strong>
          <code>Rank,Player,Position,Price,Public Value</code>
          <code>1,Jahmyr Gibbs,RB,75,68</code>
        </div>
      </Dialog>
    </div>
    <h3>How pricing works</h3>
    <p className="commissioner-help">
      When a same-season market value is included, Sunday Games compares it with your league&apos;s
      sale price to learn where the league pays premiums or finds discounts. Those adjustments
      inform simulated prices. When owner data is available, each manager&apos;s bidding tendencies
      are modeled as well.
    </p>
  </>;
}
