import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { SyntheticEvent } from "react";
import { Avatar } from "../../../../shared/ui/Avatar/Avatar";
import { accountDisplayName } from "../../../../shared/ui/Avatar/accountIdentity";
import { Button } from "../../../../shared/ui/Button/Button";
import { TextField } from "../../../../shared/ui/TextField/TextField";
import type { AuthAccount } from "../../../auth/api/authSchemas";
import { sessionQueryKey } from "../../../auth/api/sessionQuery";
import { authErrorMessage } from "../../../auth/model/authErrorMessage";
import { updateDisplayName } from "../../api/accountApi";
import { maximumDisplayNameCharacters } from "../../model/displayNamePolicy";
import "./ProfileCard.css";

export interface ProfileCardProps {
  readonly account: AuthAccount;
}

export const ProfileCard = ({ account }: ProfileCardProps) => {
  const [displayName, setDisplayName] = useState(account.displayName ?? "");
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: async () => await updateDisplayName({ displayName }),
    onSuccess: updated => {
      queryClient.setQueryData(sessionQueryKey(), { account: updated });
    },
  });
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    save.mutate();
  };
  const trimmed = displayName.trim();
  const unchanged = trimmed === (account.displayName ?? "");

  return (
    <section aria-labelledby="profile-heading" className="account-card profile-card">
      <h2 className="account-card__heading" id="profile-heading">Profile</h2>
      <div className="profile-card__body">
        <div className="profile-card__avatar">
          <Avatar
            {...(trimmed.length === 0 ? {} : { displayName: trimmed })}
            email={account.email}
            seed={account.id}
            size="lg"
          />
          <p className="profile-card__avatar-note">
            Your picture is built from your initials. Photo uploads are not available yet.
          </p>
        </div>
        <form className="profile-card__form" onSubmit={submit}>
          <TextField
            autoComplete="nickname"
            disabled={save.isPending}
            hint={`Shown to your league mates. Leave it empty to go by ${accountDisplayName(account.email)}.`}
            id="display-name"
            label="Display name"
            maxLength={maximumDisplayNameCharacters}
            onChange={event => { setDisplayName(event.currentTarget.value); }}
            value={displayName}
          />
          {save.error !== null && (
            <p className="account-card__error" role="alert">{authErrorMessage(save.error)}</p>
          )}
          {save.isSuccess && (
            <p className="account-card__success" role="status">Display name saved.</p>
          )}
          <Button disabled={save.isPending || unchanged} type="submit">
            {save.isPending ? "Saving..." : "Save display name"}
          </Button>
        </form>
      </div>
    </section>
  );
};
