import { useLocation } from "react-router-dom";

export const LeagueLocationProbe = () => {
  const location = useLocation();
  return (
    <output data-testid="league-location">
      {location.pathname}{location.search}{location.hash}
    </output>
  );
};
