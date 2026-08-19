import { requestPlatformJson } from "../../../shared/api/http/requestPlatformJson";
import { sessionSchema } from "../../auth/api/authSchemas";
import type { AuthAccount } from "../../auth/api/authSchemas";

export interface UpdateDisplayNameInput {
  readonly displayName: string;
  readonly signal?: AbortSignal;
}

export const updateDisplayName = async (input: UpdateDisplayNameInput): Promise<AuthAccount> => {
  const response = await requestPlatformJson({
    init: {
      body: JSON.stringify({ displayName: input.displayName }),
      headers: { "content-type": "application/json" },
      method: "PUT",
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    },
    path: "/session/profile",
    responseSchema: sessionSchema,
  });
  return response.account;
};
