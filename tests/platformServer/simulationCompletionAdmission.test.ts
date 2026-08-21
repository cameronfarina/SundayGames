import { expect, it, requestBeforeSendingBody } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer }) => {
  it("rejects an unauthenticated large completion before reading its body", async () => {
    const { baseUrl } = await createListeningServer();

    const pending = await requestBeforeSendingBody(
      baseUrl,
      "/season-simulations/history-1/complete",
      undefined,
      1_100_000,
    );
    pending.request.destroy();

    expect(pending.response).toMatchObject({
      status: 401,
      body: { error: { code: "auth_required" } },
    });
  });
});
