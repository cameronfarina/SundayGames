interface ConnectionMutationState {
  readonly isPending: boolean;
  readonly variables: string | undefined;
}

/**
 * Sync and disconnect both take a moment, and only the card being acted on
 * should lose its buttons. Whichever mutation is in flight names that card.
 */
export const pendingConnectionId = (
  sync: ConnectionMutationState,
  remove: ConnectionMutationState,
): string | undefined => {
  if (sync.isPending) return sync.variables;
  return remove.isPending ? remove.variables : undefined;
};
