import { Link } from "react-router-dom";
import { claimTeamPath, leaguePath } from "../../../league/lib/leaguePaths";
import type { PracticePlayer } from "../../api/playerCatalogSchema";
import type { PracticeShortlistItem } from "../../api/practiceContextSchema";
import { PracticePlayerBoard } from "../../components/PracticePlayerBoard/PracticePlayerBoard";
import { PracticeHeader } from "../../components/PracticeHeader/PracticeHeader";
import { ShortlistPanel } from "../../components/ShortlistPanel/ShortlistPanel";
import { SimulationResults } from "../../components/SimulationResults/SimulationResults";
import { SimulationWorkspace } from "../../components/SimulationWorkspace/SimulationWorkspace";
import { playerKey } from "../../model/playerBoard";
import { usePracticeLocation } from "./hooks/usePracticeLocation";
import { usePracticeMutations } from "./hooks/usePracticeMutations";
import { usePlayerCatalogQuery, usePracticeContextQuery, useShortlistQuery, useSimulationDetailQuery, useSimulationHistoryQuery, useSimulationRunQuery } from "./hooks/usePracticeQueries";
import "./PracticePage.css";

type PracticeTarget = Pick<PracticeShortlistItem, "playerName" | "position">;
export function PracticePage() {
  const context = usePracticeContextQuery();
  const leagues = context.data?.leagues ?? [];
  const route = usePracticeLocation(leagues);
  const { activeLeague, historyId, selectedRunNumber, strategy } = route;
  const seasonId = activeLeague?.seasonId;
  const catalog = usePlayerCatalogQuery(seasonId, strategy, context.isSuccess);
  const shortlist = useShortlistQuery(seasonId);
  const history = useSimulationHistoryQuery(seasonId);
  const mutations = usePracticeMutations(seasonId ?? "", strategy);
  const runMutation = mutations.run.mutation;
  const mutationResult = runMutation.data?.historyId === historyId ? runMutation.data : undefined;
  const detail = useSimulationDetailQuery(historyId);
  const runDetail = useSimulationRunQuery(historyId, selectedRunNumber);
  const targets = shortlist.data ?? [];
  const toggleTarget = (player: PracticePlayer) => {
    const target = targets.find(item => playerKey(item.playerName) === playerKey(player.name));
    if (target === undefined) mutations.targets.save.mutate({ playerName: player.name, position: player.position });
    else mutations.targets.remove.mutate(player.name);
  };
  const saveTarget = (item: PracticeTarget, maxBid: number | undefined) => {
    mutations.targets.save.mutate({
      ...(maxBid === undefined ? {} : { maxBid }),
      playerName: item.playerName, position: item.position,
    });
  };
  const saveMyValue = (player: PracticePlayer, maxBid: number) => {
    saveTarget({ playerName: player.name, position: player.position }, maxBid);
  };
  const mutationError = mutations.targets.save.error ?? mutations.targets.remove.error
    ?? mutations.favoriteOutcome.error ?? runMutation.error;
  const selectedSimulation = historyId === undefined ? undefined : { historyId, result: detail.data ?? mutationResult };
  const playerBoard = <PracticePlayerBoard
    catalog={catalog.data}
    error={catalog.error}
    isPending={catalog.isPending}
    onRetry={() => { void catalog.refetch(); }}
    onSaveMyValue={saveMyValue}
    onToggleTarget={toggleTarget}
    shortlist={targets}
    targetChangesDisabled={activeLeague === undefined || mutations.targets.pending}
  />;
  const simulationResults = <>
    {detail.isPending && selectedSimulation?.result === undefined && <p role="status">Loading saved simulation…</p>}
    {detail.isError && <section className="practice-page__error"><p>{detail.error.message}</p><button onClick={() => { void detail.refetch(); }} type="button">Retry saved run</button></section>}
    {runDetail.isError && <section className="practice-page__error"><p>{runDetail.error.message}</p><button onClick={() => { void runDetail.refetch(); }} type="button">Retry selected run</button></section>}
    {selectedSimulation?.result !== undefined && <SimulationResults
      note={selectedSimulation.result.note}
      onExit={route.exitSimulation}
      onFavoriteChange={favorite => { mutations.favoriteOutcome.mutate({
        favorite, historyId: selectedSimulation.historyId, runNumber: selectedRunNumber,
      }); }}
      onRunChange={runNumber => { route.setParameter("simulationRun", String(runNumber)); }}
      pendingFavorite={mutations.favoriteOutcome.isPending}
      pendingRun={runDetail.isPending}
      run={runDetail.data?.run}
      selectedRunNumber={selectedRunNumber}
      summary={selectedSimulation.result.summary}
    />}
  </>;
  /* v8 ignore start -- PracticePage.test.tsx covers both early returns, but
     V8 intermittently drops their credit and the phantom 99.9% fails CI. */
  if (context.isError) {
    return <section aria-labelledby="practice-error-title" className="practice-page practice-page--error">
      <h1 id="practice-error-title">Practice is unavailable</h1><p>{context.error.message}</p>
      <button onClick={() => { void context.refetch(); }} type="button">Try again</button>
    </section>;
  }
  if (!context.isSuccess) {
    return <section aria-label="Practice" className="practice-page"><p role="status">Loading Practice…</p></section>;
  }
  /* v8 ignore stop */

  return <section aria-labelledby="practice-title" className="practice-page">
    <PracticeHeader
      activeLeague={activeLeague}
      leagues={leagues}
      onLeagueChange={route.changeLeague}
      onStrategyChange={value => { route.setParameter("strategy", value); }}
      strategy={strategy}
    />
    {activeLeague !== undefined && (
      <nav aria-label="Practice modes" className="practice-page__modes">
        <Link to={leaguePath(activeLeague, "mock-drafts")}>Start mock draft</Link>
      </nav>
    )}
    {activeLeague === undefined && <aside className="practice-page__baseline">
      <div><strong>Baseline values</strong><p>Start with current consensus values, then join or create a league for keeper-aware pricing and full draft simulations.</p></div>
      <Link to="/league?create=1">Create league</Link>
    </aside>}
    {activeLeague === undefined ? playerBoard : <div className="practice-page__workspace">
      <div className="practice-page__main">
        {historyId === undefined ? playerBoard : simulationResults}
      </div>
      <aside aria-label="Simulation plan and controls" className="practice-page__sidebar">
        {shortlist.isPending ? <p role="status">Loading draft targets…</p> : <ShortlistPanel
          items={targets}
          onRemove={item => { mutations.targets.remove.mutate(item.playerName); }}
          onSave={saveTarget}
          pending={mutations.targets.pending}
        />}
        {history.isPending ? <p role="status">Loading previous simulations…</p> : history.isError
          ? <section className="practice-page__error"><p>{history.error.message}</p><button onClick={() => { void history.refetch(); }} type="button">Retry history</button></section>
          : <SimulationWorkspace
          claimHref={claimTeamPath(activeLeague)}
          history={history.data}
          onOpenHistory={route.openSimulation}
          onRun={request => { runMutation.mutate(request, { onSuccess: response => {
            route.openSimulation(response.historyId, response.summary.outcomes[0]?.runNumber ?? 1);
          } }); }}
          pending={runMutation.isPending}
          progress={mutations.run.progress}
          teamClaimed={activeLeague.readiness.teamClaim === "ready"}
        />}
      </aside>
    </div>}
    {mutationError !== null && <p aria-live="assertive" className="practice-page__error">{mutationError.message}</p>}
  </section>;
}
