import { auctionPreviewEvents } from "./previewData";
import "./AuctionPreview.css";

export const AuctionPreview = () => <section aria-label="Live auction" className="auction-preview">
  <div className="auction-preview__headline">
    <div>
      <span className="auction-preview__position">WR</span>
      <h3>Puka Nacua</h3>
      <p>Nominated by Turf Toe Tigers</p>
    </div>
    <div className="auction-preview__bid">
      <strong>Current bid $54</strong>
      <span>Red Zone Rebels has the high bid</span>
      <span>Your max bid $67</span>
    </div>
  </div>
  <div className="auction-preview__actions">
    <span className="auction-preview__buy">Bid $55</span>
    <span className="auction-preview__pass">Pass</span>
    <strong className="auction-preview__countdown">8 seconds</strong>
  </div>
  <ol aria-label="Auction activity" className="auction-preview__activity">
    {auctionPreviewEvents.map(event => <li key={event}>{event}</li>)}
  </ol>
</section>;
