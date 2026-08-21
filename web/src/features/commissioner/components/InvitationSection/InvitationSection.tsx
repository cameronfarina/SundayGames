import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { invalidatePublishedSeasonConsumers } from "../../../../shared/api/queries/seasonQueryInvalidation";
import { seasonQueryKeys } from "../../../../shared/api/queries/seasonQueryKeys";
import { Button } from "../../../../shared/ui/index.js";
import { commissionerApi } from "../../api/commissionerApi";
import type { CommissionerSeason } from "../../api/seasonSchemas";
import type { CommissionerInvitation } from "../../api/workspaceSchemas";
import { errorMessage } from "../../model/errorMessage";

interface InvitationSectionProps {
  readonly invitations: readonly CommissionerInvitation[];
  readonly season: CommissionerSeason;
}

type CopyStatus = "idle" | "copied" | "failed";

const copyStatusMessage = (status: CopyStatus): string => {
  switch (status) {
    case "copied": return "League link copied.";
    case "failed": return "Could not copy the league invitation.";
    case "idle": return "";
  }
};

const inviteUrl = (invitation: CommissionerInvitation | undefined): string => {
  if (invitation?.acceptPath === undefined) return "";
  return new URL(invitation.acceptPath, window.location.origin).toString();
};

export function InvitationSection({ invitations, season }: InvitationSectionProps) {
  const queryClient = useQueryClient();
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const fallbackInput = useRef<HTMLInputElement>(null);
  const [publishedHere, setPublishedHere] = useState(false);
  const active = invitations.find(invitation => (
    invitation.kind === "league" && invitation.status === "pending"
  ));
  const published = publishedHere || season.setupStatus !== "draft";
  const createAccess = useMutation({
    mutationFn: async () => {
      if (!published) {
        await commissionerApi.publish(season.id);
        setPublishedHere(true);
        await invalidatePublishedSeasonConsumers(queryClient, season.id);
      }
      return active ?? (await commissionerApi.createInvitation(season.id)).invitation;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: seasonQueryKeys.commissionerInvitations(season.id),
      });
    },
  });
  const current = published ? (createAccess.data ?? active) : undefined;
  const url = inviteUrl(current);
  const copyFailed = copyStatus === "failed";
  const copyMessage = copyStatusMessage(copyStatus);
  useEffect(() => {
    if (!copyFailed) return;
    fallbackInput.current?.focus();
    fallbackInput.current?.select();
  }, [copyFailed]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };
  const actionLabel = published ? "Create league invitation" : "Create and publish league";

  return (
    <div className="commissioner-invitation">
      <span className={url ? "commissioner-invitation__name" : "commissioner-fact-label"}>
        {url ? <>{season.league.name}<span aria-hidden="true">·</span></> : "League access"}
      </span>
      {url ? (
        <Button
          aria-label="Copy league invitation"
          className="commissioner-invitation__copy"
          onClick={() => { void copy(); }}
          variant="secondary"
        >
          <Copy aria-hidden="true" size={18} />
        </Button>
      ) : (
        <Button
          aria-busy={createAccess.isPending}
          disabled={createAccess.isPending}
          onClick={() => { createAccess.mutate(); }}
        >
          {createAccess.isPending
            ? (published ? "Creating invitation..." : "Publishing league...")
            : actionLabel}
        </Button>
      )}
      {createAccess.isPending ? (
        <p role="status">{published ? "Creating league invitation..." : "Publishing league..."}</p>
      ) : null}
      {createAccess.isError ? <p role="alert">{errorMessage(createAccess.error)}</p> : null}
      {copyFailed ? (
        <label>
          League invitation link
          <input
            aria-label="League invitation link"
            className="commissioner-copy-input"
            readOnly
            ref={fallbackInput}
            value={url}
          />
        </label>
      ) : null}
      {copyMessage ? (
        <p role={copyFailed ? "alert" : "status"}>{copyMessage}</p>
      ) : null}
    </div>
  );
}
