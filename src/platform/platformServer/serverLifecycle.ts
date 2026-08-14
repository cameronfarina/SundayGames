import type { Server } from "node:http";

export const closeServer = async (server: Server): Promise<void> => {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close(error => {
      if (error === undefined) resolve();
      else reject(error);
    });
  });
};

export const listen = async (server: Server, port: number, host: string): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
};

export const hostForUrl = (host: string): string => host.includes(":") ? `[${host}]` : host;
