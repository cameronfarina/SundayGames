export interface PostgresNotification {
  channel: string;
  payload?: string | undefined;
}

export interface PostgresNotificationConnection {
  onNotification(listener: (notification: PostgresNotification) => void): void;
  removeNotificationListener(listener: (notification: PostgresNotification) => void): void;
  onError(listener: (error: Error) => void): void;
  removeErrorListener(listener: (error: Error) => void): void;
  query(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: unknown[]; rowCount: number | null }>;
  release(): void;
}

export interface PostgresNotificationSubscription {
  close(): Promise<void>;
}

export interface PostgresNotificationClient {
  listen(
    channel: string,
    onPayload: (payload: string) => void,
  ): Promise<PostgresNotificationSubscription>;
}

export const openPostgresNotificationSubscription = async (
  connection: PostgresNotificationConnection,
  channel: string,
  onPayload: (payload: string) => void,
): Promise<PostgresNotificationSubscription> => {
  if (!/^[a-z][a-z0-9_]*$/.test(channel)) {
    connection.release();
    throw new Error("Postgres notification channel must be a lowercase SQL identifier.");
  }
  const quotedChannel = `"${channel}"`;
  const notificationListener = (notification: PostgresNotification): void => {
    if (notification.channel === channel && notification.payload !== undefined) {
      onPayload(notification.payload);
    }
  };
  let connectionFailed = false;
  const errorListener = (): void => {
    connectionFailed = true;
  };
  connection.onNotification(notificationListener);
  connection.onError(errorListener);
  try {
    await connection.query(`LISTEN ${quotedChannel}`);
  } catch (error) {
    connection.removeNotificationListener(notificationListener);
    connection.removeErrorListener(errorListener);
    connection.release();
    throw error;
  }

  let closed = false;
  return {
    close: async () => {
      if (closed) return;
      closed = true;
      try {
        if (!connectionFailed) await connection.query(`UNLISTEN ${quotedChannel}`);
      } finally {
        connection.removeNotificationListener(notificationListener);
        connection.removeErrorListener(errorListener);
        connection.release();
      }
    },
  };
};
