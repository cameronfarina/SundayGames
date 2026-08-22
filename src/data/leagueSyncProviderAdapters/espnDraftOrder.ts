const positiveTeamId = (value: unknown): string | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? String(value)
    : null;

/** ESPN publishes snake order as numeric team ids under draftSettings.pickOrder. */
export const espnPickOrderFor = (draftSettings: Readonly<Record<string, unknown>>): string[] => {
  if (!Array.isArray(draftSettings.pickOrder)) return [];
  return draftSettings.pickOrder.flatMap(value => {
    const teamId = positiveTeamId(value);
    return teamId === null ? [] : [teamId];
  });
};

/** Keep ESPN's declared picks first and make its remaining team order stable. */
export const teamsInEspnDraftOrder = <Team>(
  teams: readonly Team[],
  pickOrder: readonly string[],
  teamIdFor: (team: Team) => string,
): Team[] => {
  const positions = new Map(pickOrder.map((teamId, index) => [teamId, index]));
  return [...teams].sort((left, right) => {
    const leftId = teamIdFor(left);
    const rightId = teamIdFor(right);
    return (positions.get(leftId) ?? Number.MAX_SAFE_INTEGER)
      - (positions.get(rightId) ?? Number.MAX_SAFE_INTEGER)
      || Number(leftId) - Number(rightId);
  });
};
