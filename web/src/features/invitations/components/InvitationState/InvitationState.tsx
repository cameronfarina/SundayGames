export function InvitationLoading() {
  return <p aria-live="polite">Loading league invitation...</p>;
}

export function InvitationError({ message }: { readonly message: string }) {
  return (
    <section className="invite-state" aria-label="Invitation unavailable">
      <h1>Invitation unavailable</h1>
      <p role="alert">{message}</p>
    </section>
  );
}
