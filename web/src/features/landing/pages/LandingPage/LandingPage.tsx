import { LandingCarousel } from "../../components/LandingCarousel/LandingCarousel";
import { LandingClosing } from "../../components/LandingClosing/LandingClosing";
import { LandingMasthead } from "../../components/LandingMasthead/LandingMasthead";
import { LandingStory } from "../../components/LandingStory/LandingStory";
import { AuctionPreview } from "../../components/previews/AuctionPreview";
import { BoardPreview } from "../../components/previews/BoardPreview";
import { TargetsPreview } from "../../components/previews/TargetsPreview";

export const LandingPage = () => <>
  <LandingMasthead />
  <LandingStory
    body="The board shows what the room will pay and what the math says. You set your own number in the last column. Every mock and every simulation then runs on your price."
    eyebrow="The board"
    heading="Argue with the market."
    media={<BoardPreview />}
    mediaSide="left"
  />
  <LandingStory
    body="Nacua is up. Three owners have bid. Eight seconds on the clock and it is your turn. Get that wrong here, not in August with your league watching."
    eyebrow="The mock"
    heading="Feel the panic first."
    media={<AuctionPreview />}
    mediaSide="right"
  />
  <LandingStory
    body="Star the players you want. Write down the most you will pay. The plan holds when the room heats up."
    eyebrow="The plan"
    heading="Decide your ceiling while you are calm."
    media={<TargetsPreview />}
    mediaSide="left"
  />
  <LandingCarousel />
  <LandingClosing />
</>;
