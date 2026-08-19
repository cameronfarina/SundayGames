import type { AuthMailSender, SignupNotifier } from "../auth.js";
import {
  createFantasyProsClient,
  pacedFantasyProsClient,
  type FantasyProsClient,
} from "../../data/fantasyPros.js";
import {
  createOpenAiLeagueMembersScreenshotAnalyzer,
  type LeagueMembersScreenshotAnalyzer,
} from "../openAiLeagueMembersScreenshotAnalyzer.js";
import type { PlatformRuntimeConfig } from "../platformRuntimeConfig.js";
import { createResendAuthMailSender } from "../resendAuthMailSender.js";
import { createResendSignupNotifier } from "../resendSignupNotifier.js";

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

export const signupNotifierFor = (
  config: PlatformRuntimeConfig,
  dependency: SignupNotifier | undefined,
): SignupNotifier | undefined => {
  if (dependency !== undefined) return dependency;
  if (
    config.authEmail.mode !== "resend"
    || config.authEmail.resendApiKey === undefined
    || config.authEmail.from === undefined
    || config.authEmail.signupNotificationEmail === undefined
  ) return undefined;

  return createResendSignupNotifier({
    apiKey: config.authEmail.resendApiKey,
    from: config.authEmail.from,
    to: config.authEmail.signupNotificationEmail,
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

export const fantasyProsClientFor = (
  config: PlatformRuntimeConfig,
): FantasyProsClient | undefined => {
  if (!config.fantasyPros.refreshEnabled) return undefined;
  if (config.fantasyPros.apiKey === undefined) return undefined;

  // Paced at the one place the production client is built, so every request
  // the refresh makes is spaced without any caller having to remember.
  return pacedFantasyProsClient(createFantasyProsClient({
    apiKey: config.fantasyPros.apiKey,
    season: config.fantasyPros.season,
  }));
};
