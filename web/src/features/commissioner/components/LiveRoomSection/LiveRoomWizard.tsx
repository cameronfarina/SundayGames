import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import {
  invalidateLiveRoomConsumers,
  invalidatePublishedSeasonConsumers,
} from "../../../../shared/api/queries/seasonQueryInvalidation";
import { Button, Dialog } from "../../../../shared/ui/index.js";
import { commissionerApi } from "../../api/commissionerApi";
import type { CommissionerSeason } from "../../api/seasonSchemas";
import { errorMessage } from "../../model/errorMessage";
import { dateTimeLocalToIsoInstant, isoInstantToDateTimeLocal } from "./draftDateTime";
import { formatDraftTime } from "./liveRoomDisplay";
export type CreatedLiveRoom = Awaited<ReturnType<typeof commissionerApi.createRoom>>["room"];
interface LiveRoomWizardProps {
  readonly initialStartsAt: string | undefined;
  readonly leagueName: string;
  readonly onPublished: () => void;
  readonly onRoomCreated: (room: CreatedLiveRoom) => void;
  readonly published: boolean;
  readonly season: CommissionerSeason;
  readonly timeZone: string;
}
type WizardStep = "readiness" | "schedule" | "confirm";
export function LiveRoomWizard(
  { initialStartsAt, leagueName, onPublished, onRoomCreated, published, season, timeZone }:
  LiveRoomWizardProps) {
  const queryClient = useQueryClient();
  const [localStartsAt, setLocalStartsAt] = useState(
    initialStartsAt === undefined ? "" : isoInstantToDateTimeLocal(initialStartsAt),
  );
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState<WizardStep | null>(null);
  const publish = useMutation({
    mutationFn: () => commissionerApi.publish(season.id),
    onSuccess: async () => {
      await invalidatePublishedSeasonConsumers(queryClient, season.id);
      onPublished();
      setWizardStep(currentStep => currentStep === null ? null : "schedule");
    },
  });
  const create = useMutation({
    mutationFn: () => commissionerApi.createRoom(season.id,
      dateTimeLocalToIsoInstant(localStartsAt, season.draft?.scheduledAt)),
    onSuccess: async ({ room }) => {
      setWizardStep(null);
      onRoomCreated(room);
      await invalidateLiveRoomConsumers(queryClient, season.id);
    },
  });
  const reviewSchedule = () => {
    try {
      dateTimeLocalToIsoInstant(localStartsAt, season.draft?.scheduledAt);
      setScheduleError(null);
      setWizardStep("confirm");
    } catch (error) {
      setScheduleError(errorMessage(error));
    }
  };
  const confirmedDraftAt = wizardStep === "confirm"
    ? dateTimeLocalToIsoInstant(localStartsAt, season.draft?.scheduledAt)
    : null;
  const renderFooter = (): ReactNode => {
    if (wizardStep === "readiness") {
      return <Button
        aria-busy={publish.isPending}
        disabled={publish.isPending}
        onClick={() => {
          if (published) setWizardStep("schedule");
          else publish.mutate();
        }}
      >
        {publish.isPending
          ? "Publishing league..."
          : published ? "Continue to schedule" : "Publish and continue"}
      </Button>;
    }
    if (wizardStep === "schedule") {
      return <>
        <Button variant="secondary" onClick={() => { setWizardStep("readiness"); }}>Back</Button>
        <Button disabled={localStartsAt === ""} onClick={reviewSchedule}>Review draft room</Button>
      </>;
    }
    if (wizardStep === "confirm") {
      return <>
        <Button variant="secondary" onClick={() => { setWizardStep("schedule"); }}>Back</Button>
        <Button aria-busy={create.isPending} disabled={create.isPending} onClick={() => { create.mutate(); }}>
          {create.isPending ? "Creating room..." : "Create live draft room"}
        </Button>
      </>;
    }
    return null;
  };
  return <Dialog
    description="Check readiness, choose a draft time, and review the room before creating it."
    footer={renderFooter()}
    onOpenChange={(open) => {
      setWizardStep(open ? "readiness" : null);
      if (!open) setScheduleError(null);
    }}
    open={wizardStep !== null}
    title="Prepare live draft"
    trigger={<Button>Plan live draft</Button>}
  >
    {wizardStep === "readiness" ? <div>
      <p>Step 1 of 3</p>
      <h3>Readiness</h3>
      <p>{published
        ? "League setup is published and ready to schedule."
        : "Publish the reviewed teams, rules, keepers, and player catalog before scheduling."}</p>
      <p><strong>League setup:</strong> {published ? "Published" : "Ready for review"}</p>
      {publish.isPending ? <p role="status">Publishing league...</p> : null}
      {publish.isError ? <p role="alert">{errorMessage(publish.error)}</p> : null}
    </div> : null}
    {wizardStep === "schedule" ? <div>
      <p>Step 2 of 3</p>
      <h3>Schedule</h3>
      <label htmlFor="draft-starts-at">Draft date and time</label>
      <p id="draft-starts-at-time-zone">
        Times use {timeZone}. If clocks repeat an hour, new times use the first occurrence.
      </p>
      <input
        aria-describedby={scheduleError === null
          ? "draft-starts-at-time-zone"
          : "draft-starts-at-time-zone draft-starts-at-error"}
        aria-invalid={scheduleError !== null}
        className="commissioner-date-input"
        id="draft-starts-at"
        type="datetime-local"
        value={localStartsAt}
        onChange={(event) => { setLocalStartsAt(event.target.value); setScheduleError(null); }}
      />
      {scheduleError === null
        ? null
        : <p id="draft-starts-at-error" role="alert">{scheduleError}</p>}
    </div> : null}
    {wizardStep === "confirm" && confirmedDraftAt !== null ? <div>
      <p>Step 3 of 3</p>
      <h3>Confirm</h3>
      <p><strong>League:</strong> {leagueName}</p>
      <p><strong>Draft time:</strong> <time dateTime={confirmedDraftAt}>
        {formatDraftTime(confirmedDraftAt, timeZone)}
      </time></p>
      <p><strong>Time zone:</strong> {timeZone}</p>
      {create.isPending ? <p role="status">Creating live room...</p> : null}
      {create.isError ? <p role="alert">{errorMessage(create.error)}</p> : null}
    </div> : null}
  </Dialog>;
}
