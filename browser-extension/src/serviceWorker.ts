import { readEspnCredentialPair, type CookieLookupApi } from "./cookieSession.js";
import { isAllowedSundayGamesUrl } from "./serviceWorkerPolicy.js";

interface RuntimeMessageSender {
  readonly url?: string;
}

interface RuntimeMessageApi {
  readonly addListener: (listener: (
    message: unknown,
    sender: RuntimeMessageSender,
    sendResponse: (response: unknown) => void,
  ) => boolean) => void;
}

declare const chrome: {
  readonly cookies: CookieLookupApi;
  readonly runtime: { readonly onMessage: RuntimeMessageApi };
};

const channel = "sunday-games-espn-connector-v1";
const isAllowedSender = (sender: RuntimeMessageSender): boolean => {
  return sender.url !== undefined && isAllowedSundayGamesUrl(sender.url);
};

const isCredentialRequest = (message: unknown): boolean => {
  if (message === null || typeof message !== "object") return false;
  return Reflect.get(message, "channel") === channel
    && Reflect.get(message, "direction") === "to-background"
    && Reflect.get(message, "type") === "read-credentials";
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isAllowedSender(sender) || !isCredentialRequest(message)) return false;
  void readEspnCredentialPair(chrome.cookies).then(sendResponse).catch(() => {
    sendResponse({ code: "read_failed", ok: false });
  });
  return true;
});
