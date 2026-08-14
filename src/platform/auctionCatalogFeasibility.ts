interface CatalogPlayer {
  position: string;
  available: boolean;
}

interface OpenRosterSlot {
  eligiblePositions: readonly string[];
  playerId: string | undefined;
}

interface CatalogTeam {
  positionCounts: Readonly<Record<string, number>>;
  slots: readonly OpenRosterSlot[];
}

interface CatalogFeasibilityInput {
  players: readonly CatalogPlayer[];
  teams: readonly CatalogTeam[];
  positionMaximums: Readonly<Record<string, number>>;
}

interface FlowGraph {
  adjacency: Map<string, Set<string>>;
  capacity: Map<string, Map<string, number>>;
}

const capacityFor = (graph: FlowGraph, from: string, to: string): number =>
  graph.capacity.get(from)?.get(to) ?? 0;

const setCapacity = (graph: FlowGraph, from: string, to: string, value: number): void => {
  const row = graph.capacity.get(from) ?? new Map<string, number>();
  row.set(to, value);
  graph.capacity.set(from, row);
};

const addEdge = (graph: FlowGraph, from: string, to: string, capacity: number): void => {
  const fromNeighbors = graph.adjacency.get(from) ?? new Set<string>();
  const toNeighbors = graph.adjacency.get(to) ?? new Set<string>();
  fromNeighbors.add(to);
  toNeighbors.add(from);
  graph.adjacency.set(from, fromNeighbors);
  graph.adjacency.set(to, toNeighbors);
  setCapacity(graph, from, to, capacityFor(graph, from, to) + capacity);
  setCapacity(graph, to, from, capacityFor(graph, to, from));
};

const augmentingPathFor = (
  graph: FlowGraph,
  source: string,
  sink: string,
): Map<string, string> | undefined => {
  const parents = new Map<string, string>();
  const visited = new Set([source]);
  const queue = [source];

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current === undefined) continue;
    for (const next of graph.adjacency.get(current) ?? []) {
      if (visited.has(next) || capacityFor(graph, current, next) <= 0) continue;
      parents.set(next, current);
      if (next === sink) return parents;
      visited.add(next);
      queue.push(next);
    }
  }

  return undefined;
};

const maximumFlow = (graph: FlowGraph, source: string, sink: string): number => {
  let flow = 0;
  let parents = augmentingPathFor(graph, source, sink);
  while (parents !== undefined) {
    let increment = Number.POSITIVE_INFINITY;
    let current = sink;
    while (current !== source) {
      const previous = parents.get(current);
      if (previous === undefined) return flow;
      increment = Math.min(increment, capacityFor(graph, previous, current));
      current = previous;
    }
    current = sink;
    while (current !== source) {
      const previous = parents.get(current);
      if (previous === undefined) return flow;
      setCapacity(graph, previous, current, capacityFor(graph, previous, current) - increment);
      setCapacity(graph, current, previous, capacityFor(graph, current, previous) + increment);
      current = previous;
    }
    flow += increment;
    parents = augmentingPathFor(graph, source, sink);
  }
  return flow;
};

export const auctionCatalogCanFillOpenRosters = ({
  players,
  teams,
  positionMaximums,
}: CatalogFeasibilityInput): boolean => {
  const graph: FlowGraph = { adjacency: new Map(), capacity: new Map() };
  const source = "source";
  const sink = "sink";
  const supplyByPosition = new Map<string, number>();
  for (const player of players) {
    if (!player.available) continue;
    supplyByPosition.set(player.position, (supplyByPosition.get(player.position) ?? 0) + 1);
  }
  for (const [position, supply] of supplyByPosition) {
    addEdge(graph, source, `position:${position}`, supply);
  }

  let openSlotCount = 0;
  teams.forEach((team, teamIndex) => {
    const openSlots = team.slots.filter(slot => slot.playerId === undefined);
    openSlots.forEach((slot, slotIndex) => {
      const slotNode = `team:${teamIndex}:slot:${slotIndex}`;
      addEdge(graph, slotNode, sink, 1);
      openSlotCount += 1;
    });
    for (const [position, maximum] of Object.entries(positionMaximums)) {
      const remainingMaximum = maximum - (team.positionCounts[position] ?? 0);
      if (remainingMaximum <= 0 || (supplyByPosition.get(position) ?? 0) === 0) continue;
      const gateIn = `team:${teamIndex}:position:${position}:in`;
      const gateOut = `team:${teamIndex}:position:${position}:out`;
      addEdge(graph, `position:${position}`, gateIn, remainingMaximum);
      addEdge(graph, gateIn, gateOut, remainingMaximum);
      openSlots.forEach((slot, slotIndex) => {
        if (slot.eligiblePositions.includes(position)) {
          addEdge(graph, gateOut, `team:${teamIndex}:slot:${slotIndex}`, 1);
        }
      });
    }
  });

  return maximumFlow(graph, source, sink) === openSlotCount;
};
