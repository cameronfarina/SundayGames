export interface SignupNotification {
  email: string;
  signedUpAt: Date;
}

export interface SignupNotifier {
  notify(notification: SignupNotification): Promise<void>;
}

export class CapturingSignupNotifier implements SignupNotifier {
  readonly notifications: SignupNotification[] = [];

  async notify(notification: SignupNotification): Promise<void> {
    this.notifications.push({ ...notification });
  }
}
