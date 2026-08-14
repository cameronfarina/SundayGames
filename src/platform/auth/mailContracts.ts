export interface AuthMailMessage {
  to: string;
  subject: string;
  text: string;
  actionUrl: string;
}

export interface AuthMailSender {
  send(message: AuthMailMessage): Promise<void>;
}

export class CapturingAuthMailSender implements AuthMailSender {
  readonly messages: AuthMailMessage[] = [];

  async send(message: AuthMailMessage): Promise<void> {
    this.messages.push({ ...message });
  }
}
