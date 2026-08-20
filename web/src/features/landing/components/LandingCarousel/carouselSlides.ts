import cardBoard from "../../assets/card-board.jpg";
import cardConnect from "../../assets/card-connect.jpg";
import cardLineup from "../../assets/card-lineup.jpg";
import cardNews from "../../assets/card-news.jpg";
import cardRoster from "../../assets/card-roster.jpg";

export interface CarouselSlide {
  readonly alt: string;
  readonly image: string;
  readonly line: string;
  readonly title: string;
}

export const carouselSlides: readonly CarouselSlide[] = [
  {
    alt: "The draft board, showing the picks made in rounds one and two",
    image: cardBoard,
    line: "Every pick in the room, round by round.",
    title: "Draft board",
  },
  {
    alt: "A simulated roster with each slot scored for week one",
    image: cardLineup,
    line: "The roster you end up with, scored.",
    title: "Simulated lineups",
  },
  {
    alt: "A live draft team panel showing budget left, budget spent, and open slots",
    image: cardRoster,
    line: "Budget, spent, and every open slot.",
    title: "Live draft room",
  },
  {
    alt: "The player news feed with an analyst take on a roster move",
    image: cardNews,
    line: "Updates and analyst takes.",
    title: "Player news",
  },
  {
    alt: "The league sync screen listing the leagues found for a Sleeper username",
    image: cardConnect,
    line: "Bring in Sleeper or ESPN.",
    title: "League sync",
  },
];
