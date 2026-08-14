import { InMemoryPlatformStore, createPlatformApp, createPlatformHttpHandler, describe, expect, it, mockRunner } from "./support/index.js";
import type { PlatformApp } from "./support/index.js";

describe("platform HTTP contract", () => {
it("maps known domain errors and unexpected failures without leaking stack traces", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);

    const unauthenticated = await handle({
      method: "GET",
      path: "/seasons/missing-season",
    });

    expect(JSON.stringify(unauthenticated.body)).not.toContain("stack");
    expect(unauthenticated).toEqual({
      status: 401,
      body: {
        error: {
          code: "auth_required",
          message: "Sign in before using this workspace.",
        },
      },
    });

    const unknownFailureApp: Pick<PlatformApp, "createAccount"> = {
      createAccount: () => {
        throw new Error("database stack trace with secrets");
      },
    };
    const failingHandle = createPlatformHttpHandler({
      ...app,
      createAccount: unknownFailureApp.createAccount,
    });

    const failure = await failingHandle({
      method: "POST",
      path: "/accounts",
      body: {
        email: "fail@example.com",
        password: "secure password",
      },
    });

    expect(JSON.stringify(failure.body)).not.toContain("database stack trace with secrets");
    expect(JSON.stringify(failure.body)).not.toContain("stack");
    expect(failure).toEqual({
      status: 500,
      body: {
        error: {
          code: "internal_error",
          message: "Something went wrong.",
        },
      },
    });
  });
});
