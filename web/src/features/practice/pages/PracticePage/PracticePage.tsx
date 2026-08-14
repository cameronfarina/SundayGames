import { Link, useSearchParams } from "react-router-dom";
import type { PracticePlayer } from "../../api/playerCatalogSchema";
import type { PracticeShortlistItem } from "../../api/practiceContextSchema";
import { PlayerBoard } from "../../components/PlayerBoard/PlayerBoard";
import { PracticeHeader } from "../../components/PracticeHeader/PracticeHeader";
import { ShortlistPanel } from "../../components/ShortlistPanel/ShortlistPanel";
import { SimulationResults } from "../../components/SimulationResults/SimulationResults";
import { SimulationWorkspace } from "../../components/SimulationWorkspace/SimulationWorkspace";
import { playerKey } from "../../model/playerBoard";
import { practiceStrategy, selectedPracticeLeague } from "../../model/practiceNavigation";
import { usePracticeMutations } from "./hooks/usePracticeMutations";
import {
  usePlayerCatalogQuery,
  usePracticeContextQuery,
  useShortlistQuery,
  useSimulationDetailQuery,
  useSimulationHistoryQuery,
  useSimulationRunQuery,
} from "./hooks/usePracticeQueries";
import "./PracticePage.css";

const messageFor = (error: Error): string => error.message;

export function PracticePage() {
  const [params, setParams] = useSearchParams();
  const historyId = params.get("runId") ?? undefined;
  const requestedRunNumber = Number(params.get("simulationRun") ?? "1");
  const selectedRunNumber = Number.isInteger(requestedRunNumber) && requestedRunNumber > 0
    ? requestedRunNumber
    : 1;
  const context = usePracticeContextQuery();
  const strategy = practiceStrategy(params.get("strategy"));
  const leagues = context.data?.leagues ?? [];
  const activeLeague = selectedPracticeLeague(leagues, params.get("seasonId"));
  const seasonId = activeLeague?.seasonId;
  const catalog = usePlayerCatalogQuery(seasonId, strategy, context.isSuccess);
  const shortlist = useShortlistQuery(seasonId);
  const history = useSimulationHistoryQuery(seasonId);
  const mutations = usePracticeMutations(seasonId ?? "", strategy);
  const runMutation = mutations.run.mutation;
  const mutationResult = runMutation.data?.historyId === historyId ? runMutation.data : undefined;
  const detail = useSimulationDetailQuery(mutationResult === undefined ? historyId : undefined);
  const runDetail = useSimulationRunQuery(historyId, selectedRunNumber);
  const targets = shortlist.data ?? [];
  const mockDraftSearch = seasonId === undefined
    ? ""
    : `?${new URLSearchParams({ seasonId }).toString()}`;

  const setParameter = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(name, value);
    setParams(next);
  };
  const openSimulation = (value: string) => {
    const next = new URLSearchParams(params);
    next.set("runId", value);
    next.set("simulationRun", "1");
    setParams(next);
  };
  const toggleTarget = (player: PracticePlayer) => {
    const target = targets.find(item => playerKey(item.playerName) === playerKey(player.name));
    if (target === undefined) mutations.targets.save.mutate({ playerName: player.name, position: player.position });
    else mutations.targets.remove.mutate(player.name);
  };
  const saveTarget = (item: PracticeShortlistItem, maxBid: number | undefined) => {
    mutations.targets.save.mutate({
      ...(maxBid === undefined ? {} : { maxBid }),
      playerName: item.playerName,
      position: item.position,
    });
  };
  const mutationError = mutations.targets.save.error ?? mutations.targets.remove.error ?? runMutation.error;
  const result = detail.data ?? mutationResult;

  if (context.isPending) return <section aria-label="Practice" className="practice-page"><p role="status">Loading Practice…</p></section>;
  if (context.isError) return <section aria-labelledby="practice-error-title" className="practice-page practice-page--error">
    <h1 id="practice-error-title">Practice is unavailable</h1><p>{messageFor(context.error)}</p>
    <button onClick={() => { void context.refetch(); }} type="button">Try again</button>
  </section>;

  return <section aria-labelledby="practice-title" className="practice-page">
    <PracticeHeader
      activeLeague={activeLeague}
      leagues={leagues}
      onLeagueChange={value => { setParameter("seasonId", value); }}
      onStrategyChange={value => { setParameter("strategy", value); }}
      strategy={strategy}
    />
    {activeLeague !== undefined && (
      <nav aria-label="Practice modes" className="practice-page__modes">
        <Link to={`/mock-drafts${mockDraftSearch}`}>Start auction mock</Link>
      </nav>
    )}
    {activeLeague === undefined && <aside className="practice-page__baseline">
      <div><strong>Baseline values</strong><p>Start with current consensus values, then join a league for keeper-aware pricing and full draft simulations.</p></div>
      <Link to="/league?create=1">Create league</Link>
    </aside>}
    {catalog.isPending && <p role="status">Loading the player board…</p>}
    {catalog.isError && <section className="practice-page__error"><p>{messageFor(catalog.error)}</p><button onClick={() => { void catalog.refetch(); }} type="button">Retry board</button></section>}
    {catalog.data === undefined ? null : catalog.data.players.length === 0
      ? <p className="practice-empty">No players are available for this board yet.</p>
      : <PlayerBoard
          catalog={catalog.data}
          onToggleTarget={toggleTarget}
          shortlist={targets}
          targetChangesDisabled={activeLeague === undefined || mutations.targets.pending}
        />}
    {activeLeague !== undefined && <div className="practice-page__workspace">
      {shortlist.isPending ? <p role="status">Loading draft targets…</p> : <ShortlistPanel
        items={targets}
        onRemove={item => { mutations.targets.remove.mutate(item.playerName); }}
        onSave={saveTarget}
        pending={mutations.targets.pending}
      />}
      {history.isPending ? <p role="status">Loading previous simulations…</p> : history.isError
        ? <section className="practice-page__error"><p>{messageFor(history.error)}</p><button onClick={() => { void history.refetch(); }} type="button">Retry history</button></section>
        : <SimulationWorkspace
        history={history.data}
        onOpenHistory={openSimulation}
        onRun={request => { runMutation.mutate(request, {
          onSuccess: response => { openSimulation(response.historyId); },
        }); }}
        pending={runMutation.isPending}
        progress={mutations.run.progress}
        shortlist={targets}
        teamClaimed={activeLeague.readiness.teamClaim === "ready"}
      />}
    </div>}
    {mutationError !== null && <p aria-live="assertive" className="practice-page__error">{messageFor(mutationError)}</p>}
    {historyId !== undefined && detail.isPending && <p role="status">Loading saved simulation…</p>}
    {detail.isError && <section className="practice-page__error"><p>{messageFor(detail.error)}</p><button onClick={() => { void detail.refetch(); }} type="button">Retry saved run</button></section>}
    {runDetail.isError && <section className="practice-page__error"><p>{messageFor(runDetail.error)}</p><button onClick={() => { void runDetail.refetch(); }} type="button">Retry selected run</button></section>}
    {result !== undefined && <SimulationResults
      note={result.note}
      onRunChange={runNumber => { setParameter("simulationRun", String(runNumber)); }}
      pendingRun={runDetail.isPending}
      run={runDetail.data?.run}
      selectedRunNumber={selectedRunNumber}
      summary={result.summary}
    />}
  </section>;
}
