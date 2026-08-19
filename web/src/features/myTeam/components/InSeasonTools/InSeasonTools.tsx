import { useQuery } from "@tanstack/react-query";
import { inSeasonQueryOptions } from "../../api/myTeamQueryOptions";
import { LineupBoard } from "../LineupBoard/LineupBoard";
import { RosterRanks } from "../RosterRanks/RosterRanks";
import { WaiverBoard } from "../WaiverBoard/WaiverBoard";

export type InSeasonView = "lineup" | "waivers";

interface InSeasonToolsProps {
  readonly roomId: string;
  readonly view: InSeasonView;
}

export const InSeasonTools = ({ roomId, view }: InSeasonToolsProps) => {
  // Both tabs share this query, so moving between them costs no request.
  const query = useQuery(inSeasonQueryOptions(roomId, true));

  if (query.isPending) {
    return <p className="my-team-status" role="status">Loading FantasyPros data...</p>;
  }
  if (query.error !== null) {
    return <p className="my-team-error" role="alert">{query.error.message}</p>;
  }
  if (view === "waivers") return <WaiverBoard team={query.data} />;
  return (
    <>
      <LineupBoard team={query.data} />
      <RosterRanks team={query.data} />
    </>
  );
};
