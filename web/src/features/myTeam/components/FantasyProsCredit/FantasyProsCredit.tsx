import { formatNewsTimestamp } from "../../../playerNews/lib/formatNewsTimestamp";
import "./FantasyProsCredit.css";

interface FantasyProsCreditProps {
  readonly updatedAt?: string | undefined;
}

export const FantasyProsCredit = ({ updatedAt }: FantasyProsCreditProps) => {
  const synced = formatNewsTimestamp(updatedAt);
  return (
    <p className="fantasypros-credit">
      Data by FantasyPros{synced === undefined ? "" : ` · Synced ${synced}`}
    </p>
  );
};
