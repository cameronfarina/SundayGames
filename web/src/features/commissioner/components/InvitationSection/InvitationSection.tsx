import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "../../../../shared/ui/index.js";
import { commissionerApi } from "../../api/commissionerApi";
import type { CommissionerInvitation } from "../../api/workspaceSchemas";
import { errorMessage } from "../../model/errorMessage";
import { commissionerKeys } from "../../pages/CommissionerPage/hooks/useCommissionerWorkspace";

interface InvitationSectionProps {
  readonly invitations: readonly CommissionerInvitation[];
  readonly seasonId: string;
}

const inviteUrl = (invitation: CommissionerInvitation | undefined): string => {
  if (invitation?.acceptPath === undefined) return "";
  return new URL(invitation.acceptPath, window.location.origin).toString();
};

export function InvitationSection({ invitations, seasonId }: InvitationSectionProps) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const active = invitations.find(invitation => invitation.kind === "league" && invitation.status === "pending");
  const create = useMutation({
    mutationFn: () => commissionerApi.createInvitation(seasonId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: commissionerKeys.invitations(seasonId) });
    },
  });
  const current = create.data?.invitation ?? active;
  const url = inviteUrl(current);
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopyMessage("League link copied.");
  };
  const selectLink = () => {
    input.current?.focus();
    input.current?.select();
    setCopyMessage("Copy the selected link.");
  };

  return (
    <section className="commissioner-section" id="league-invite">
      <header><div><span>04</span><h2>League invitation</h2></div><strong>{url ? "Active" : "Not created"}</strong></header>
      <p className="commissioner-help">Share one link with the group. Each manager signs in and claims an available team.</p>
      {url ? <div className="commissioner-copy-row">
        <label htmlFor="league-invite-url">Shareable league link</label>
        <input className="commissioner-copy-input" id="league-invite-url" ref={input} readOnly value={url} />
        <Button variant="secondary" onClick={() => { copy().catch(selectLink); }}>Copy link</Button>
      </div> : null}
      <Button
        aria-busy={create.isPending}
        disabled={create.isPending}
        onClick={() => { create.mutate(); }}
        variant={url ? "secondary" : "primary"}
      >
        {create.isPending ? "Creating link..." : url ? "Generate new link" : "Create league link"}
      </Button>
      {create.isPending ? <p role="status">Creating league link...</p> : null}
      {create.isError ? <p role="alert">{errorMessage(create.error)}</p> : null}
      {copyMessage ? <p role="status">{copyMessage}</p> : null}
    </section>
  );
}
