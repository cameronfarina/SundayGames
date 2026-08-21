import tourBoard from "../../assets/tour-board.jpg";
import tourLeague from "../../assets/tour-league.jpg";
import tourPlan from "../../assets/tour-plan.jpg";
import tourSimulations from "../../assets/tour-simulations.jpg";
import tourValues from "../../assets/tour-values.jpg";

export interface TourStop {
  readonly alt: string;
  readonly image: string;
  readonly label: string;
}

const league: TourStop = {
  alt: "The connections screen listing two Sleeper leagues and two ESPN leagues, all synced",
  image: tourLeague,
  label: "League",
};

const values: TourStop = {
  alt: "The player board, with the market price, this league’s price and your own price side by side",
  image: tourValues,
  label: "Values",
};

const simulations: TourStop = {
  alt: "Simulation results showing how often each draft target was won, beside the drafted rosters",
  image: tourSimulations,
  label: "Simulations",
};

const plan: TourStop = {
  alt: "The draft lab with saved targets, maximum bids and the controls that run a full league draft",
  image: tourPlan,
  label: "Plan",
};

const auctionMock: TourStop = {
  alt: "An interactive auction mock for private practice, with money spent, rosters filling and available players on the board",
  image: tourBoard,
  label: "Auction mock",
};

/** Named separately so the component always has a stop to open on. */
export const firstTourStop = league;

export const tourStops: readonly TourStop[] = [league, values, simulations, plan, auctionMock];
