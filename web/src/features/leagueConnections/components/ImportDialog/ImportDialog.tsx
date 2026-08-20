import { useState } from "react";
import { useOnboardingQuery } from "../../../../shared/api/onboarding/onboardingQuery";
import { Button, Dialog, InlineNotice } from "../../../../shared/ui";
import type { ImportLeagueRequest } from "../../api/leagueConnectionsApi";
import type { LeagueConnection } from "../../api/leagueConnectionsSchema";
import type { useLeagueConnectionMutations } from "../../hooks/useLeagueConnectionMutations";
import { importFailure } from "../../lib/importFailure";
import { importRequest, type ImportMode } from "../../lib/importRequest";
import { ImportTarget } from "./ImportTarget";
import "./ImportDialog.css";

interface ImportDialogProps {
  readonly connection: LeagueConnection;
  readonly mutations: ReturnType<typeof useLeagueConnectionMutations>;
  readonly onClose: () => void;
}

const noteFor = (loading: boolean, leagueCount: number): string | undefined => {
  if (loading) return "Checking which leagues you already run...";
  return leagueCount === 0
    ? "You do not run a league here yet, so this import will build a new one."
    : undefined;
};

export const ImportDialog = ({ connection, mutations, onClose }: ImportDialogProps) => {
  const [mode, setMode] = useState<ImportMode>("create");
  const [seasonId, setSeasonId] = useState<string | undefined>(undefined);
  const onboarding = useOnboardingQuery();
  const leagues = (onboarding.data?.leagues ?? [])
    .filter(league => league.canManageLeague)
    .map(league => ({ label: league.leagueName, value: league.seasonId }));
  const request = importRequest(mode, seasonId);
  const failure = mutations.importLeague.error === null
    ? undefined
    : importFailure(mutations.importLeague.error);

  const start = (target: ImportLeagueRequest): void => {
    mutations.importLeague.mutate({ connectionId: connection.id, request: target }, {
      onSuccess: onClose,
    });
  };

  return <Dialog
    description={`${connection.displayName} becomes a real Sunday Games league: teams, scoring, and draft settings included.`}
    footer={<>
      <Button onClick={onClose} variant="secondary">Cancel</Button>
      {request === undefined
        ? <Button disabled>Import league</Button>
        : <Button
          disabled={mutations.importLeague.isPending}
          onClick={() => { start(request); }}
        >{mutations.importLeague.isPending ? "Importing..." : "Import league"}</Button>}
    </>}
    onOpenChange={() => { onClose(); }}
    open
    title="Import this league"
  >
    <ImportTarget
      leagues={leagues}
      mode={mode}
      note={noteFor(onboarding.isPending, leagues.length)}
      onModeChange={setMode}
      onSeasonIdChange={setSeasonId}
      seasonId={seasonId}
    />
    {failure === undefined ? null : <InlineNotice variant="error">
      {failure.message}
      {failure.issues.length === 0 ? null : <ul className="import-dialog__issues">
        {failure.issues.map(issue => <li key={issue}>{issue}</li>)}
      </ul>}
    </InlineNotice>}
  </Dialog>;
};
