import "./HowItWorks.css";

interface Step {
  readonly detail: string;
  readonly title: string;
}

const steps: readonly Step[] = [
  { detail: "Read-only import from Sleeper or ESPN", title: "Connect your league" },
  { detail: "Outcomes built from your settings", title: "Simulate the room" },
  { detail: "Targets, ceilings and backups", title: "Build your plan" },
];

export const HowItWorks = () => <section className="how-it-works" id="how-it-works">
  <ol className="how-it-works__inner">
    {steps.map((step, index) => <li key={step.title}>
      <p className="how-it-works__title">
        <span className="how-it-works__number">{index + 1}</span>
        {step.title}
      </p>
      <p className="how-it-works__detail">{step.detail}</p>
    </li>)}
  </ol>
</section>;
