export interface LogoutInput {
  actorSessionToken: string;
  now?: Date | undefined;
}

export interface ChangePlatformPasswordInput {
  actorSessionToken: string;
  currentPassword: string;
  newPassword: string;
  newPasswordConfirmation: string;
  now?: Date | undefined;
}

export interface UpdatePlatformDisplayNameInput {
  actorSessionToken: string;
  displayName: string;
  now?: Date | undefined;
}
