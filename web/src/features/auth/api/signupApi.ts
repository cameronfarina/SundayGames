import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import { requestPlatformJson } from "../../../shared/api/http/requestPlatformJson";
import { signupConfigurationSchema, signupSchema } from "./authSchemas";
import type { SignupConfiguration, SignupResponse } from "./authSchemas";

interface FetchInput { readonly fetcher?: PlatformFetch }

interface SignupInput extends FetchInput {
  readonly email: string;
  readonly invitationToken?: string;
  readonly password?: string;
  readonly returnTo: string;
}

const fetchOption = (fetcher: PlatformFetch | undefined): { fetcher?: PlatformFetch } => (
  fetcher === undefined ? {} : { fetcher }
);

const jsonRequest = (method: string, body?: object): RequestInit => ({
  ...(body === undefined ? {} : {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }),
  method,
});

export const getSignupConfiguration = async (input: FetchInput = {}): Promise<SignupConfiguration> =>
  requestPlatformJson({
    ...fetchOption(input.fetcher),
    init: jsonRequest("GET"),
    path: "/accounts",
    responseSchema: signupConfigurationSchema,
  });

export const createAccount = async (input: SignupInput): Promise<SignupResponse> => requestPlatformJson({
  ...fetchOption(input.fetcher),
  init: jsonRequest("POST", {
    email: input.email,
    ...(input.invitationToken === undefined ? {} : { invitationToken: input.invitationToken }),
    ...(input.password === undefined ? {} : { password: input.password }),
    returnTo: input.returnTo,
  }),
  path: "/accounts",
  responseSchema: signupSchema,
});
