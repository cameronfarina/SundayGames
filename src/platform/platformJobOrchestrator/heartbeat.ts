import type { PlatformJobHeartbeatScheduler } from "./handlerContracts.js";

export const startIntervalHeartbeat: PlatformJobHeartbeatScheduler = (heartbeat, intervalMs) => {
  const interval = setInterval(() => {
    void heartbeat();
  }, intervalMs);
  interval.unref?.();

  return () => {
    clearInterval(interval);
  };
};
