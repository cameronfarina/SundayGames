import type { AuthMailSender } from "../auth.js";
import {
  createOpenAiLeagueMembersScreenshotAnalyzer,
  type LeagueMembersScreenshotAnalyzer,
} from "../openAiLeagueMembersScreenshotAnalyzer.js";
import type { PlatformRuntimeConfig } from "../platformRuntimeConfig.js";
import { createResendAuthMailSender } from "../resendAuthMailSender.js";

export const authMailSenderFor = (
  config: PlatformRuntimeConfig,
  dependency: AuthMailSender | undefined,
): AuthMailSender | undefined => {
  if (dependency !== undefined) return dependency;
  if (
    config.authEmail.mode !== "resend"
    || config.authEmail.resendApiKey === undefined
    || config.authEmail.from === undefined
  ) return undefined;

  return createResendAuthMailSender({
    apiKey: config.authEmail.resendApiKey,
    from: config.authEmail.from,
  });
};

export const screenshotAnalyzerFor = (
  config: PlatformRuntimeConfig,
): LeagueMembersScreenshotAnalyzer | undefined => {
  if (config.screenshotImport.mode !== "openai") return undefined;
  if (config.screenshotImport.apiKey === undefined) return undefined;

  return createOpenAiLeagueMembersScreenshotAnalyzer({
    apiKey: config.screenshotImport.apiKey,
    model: config.screenshotImport.model,
    timeoutMs: config.screenshotImport.timeoutMs,
    maxImageBytes: config.screenshotImport.maxImageBytes,
    maxConcurrentRequests: config.screenshotImport.maxConcurrentRequests,
  });
};
