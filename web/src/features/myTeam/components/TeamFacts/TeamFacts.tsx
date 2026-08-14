import "./TeamFacts.css";

interface TeamFact {
  readonly label: string;
  readonly value: string;
}

interface TeamFactsProps {
  readonly facts: readonly TeamFact[];
}

export const TeamFacts = ({ facts }: TeamFactsProps) => (
  <dl className="my-team-facts">
    {facts.map(fact => (
      <div key={fact.label}>
        <dt>{fact.label}</dt>
        <dd><strong>{fact.value}</strong></dd>
      </div>
    ))}
  </dl>
);
