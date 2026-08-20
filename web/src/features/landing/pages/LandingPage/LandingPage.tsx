import { AppWindow } from "../../components/AppWindow/AppWindow";
import { ConnectPreview } from "../../components/ConnectPreview/ConnectPreview";
import { HowItWorks } from "../../components/HowItWorks/HowItWorks";
import { LandingClosing } from "../../components/LandingClosing/LandingClosing";
import { LandingHero } from "../../components/LandingHero/LandingHero";
import { LandingProof } from "../../components/LandingProof/LandingProof";
import { LandingStory } from "../../components/LandingStory/LandingStory";
import { MockRoom } from "../../components/MockRoom/MockRoom";
import { ProductTour } from "../../components/ProductTour/ProductTour";
import { ValueShowcase } from "../../components/ValueShowcase/ValueShowcase";
import { TargetsPreview } from "../../components/previews/TargetsPreview";

export const LandingPage = () => <>
  <LandingHero />
  <HowItWorks />
  <LandingStory
    body="Your format, scoring, keepers and league history change what every player is worth. Connect your league and Sunday Games builds the rest of your draft room around the competition you actually face."
    bullets={[
      "Your scoring and roster settings",
      "Your league’s draft history",
      "Your keeper and budget conditions",
    ]}
    eyebrow="Start with your league"
    heading="Generic rankings don’t know your league."
    media={<AppWindow><ConnectPreview /></AppWindow>}
    mediaSide="right"
  />
  <ValueShowcase />
  <MockRoom />
  <LandingStory
    body="Set your targets and maximum bids, then see how every choice affects the rest of your roster. When the draft moves differently than expected, you already have another path."
    eyebrow="Your draft plan"
    heading="Know your move before you need it."
    media={<AppWindow activeLabel="Practice"><TargetsPreview /></AppWindow>}
    mediaSide="left"
    note="Because no draft goes exactly to plan."
  />
  <ProductTour />
  <LandingProof />
  <LandingClosing />
</>;
