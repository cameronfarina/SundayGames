interface ExtensionRuntime {
  readonly sendMessage: (message: unknown) => Promise<unknown>;
}

declare const chrome: { readonly runtime: ExtensionRuntime };

const channel = "sunday-games-espn-connector-v1";

const isPageRequest = (message: unknown): message is {
  readonly direction: "to-extension";
  readonly requestId: string;
  readonly type: "read-credentials" | "status";
} => {
  if (message === null || typeof message !== "object") return false;
  const type = Reflect.get(message, "type");
  return Reflect.get(message, "channel") === channel
    && Reflect.get(message, "direction") === "to-extension"
    && typeof Reflect.get(message, "requestId") === "string"
    && (type === "read-credentials" || type === "status");
};

const postResponse = (requestId: string, response: Record<string, unknown>): void => {
  window.postMessage({
    channel,
    direction: "to-page",
    requestId,
    ...response,
  }, window.location.origin);
};

window.addEventListener("message", event => {
  const request: unknown = event.data;
  if (event.source !== window || event.origin !== window.location.origin || !isPageRequest(request)) {
    return;
  }
  if (request.type === "status") {
    postResponse(request.requestId, { type: "status" });
    return;
  }
  void chrome.runtime.sendMessage({
    channel,
    direction: "to-background",
    type: "read-credentials",
  }).then(response => {
    if (response !== null && typeof response === "object" && Reflect.get(response, "ok") === true) {
      postResponse(request.requestId, {
        credentials: Reflect.get(response, "credentials"),
        type: "credentials",
      });
      return;
    }
    const code = response !== null && typeof response === "object"
      ? Reflect.get(response, "code")
      : undefined;
    postResponse(request.requestId, {
      code: code === "not_signed_in" ? "not_signed_in" : "read_failed",
      type: "error",
    });
  }).catch(() => {
    postResponse(request.requestId, { code: "read_failed", type: "error" });
  });
});
