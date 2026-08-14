import type { AccountRecord } from "../../../src/platform/auth.js";
import type { PlatformHttpHandler } from "../../../src/platform/platformHttp.js";
import { expectAccount, expectBodyRecord, sessionTokenFrom } from "./assertions.js";
import { now } from "./fixtures.js";

export interface LoggedInAccount {
  account: AccountRecord;
  sessionToken: string;
}

export const createLoggedInAccount = async (
  handle: PlatformHttpHandler,
  email: string,
): Promise<LoggedInAccount> => {
  await handle({
    method: "POST",
    path: "/accounts",
    body: {
      email,
      password: "secure password",
      now,
    },
  });
  const login = await handle({
    method: "POST",
    path: "/sessions",
    body: {
      email,
      password: "secure password",
      now,
    },
  });
  const loginBody = expectBodyRecord(login.body);
  return {
    account: expectAccount(loginBody.account),
    sessionToken: sessionTokenFrom(login),
  };
};
