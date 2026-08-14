import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import { requestPlatformJson } from "../../../shared/api/http/requestPlatformJson";
import {
  acceptedSchema,
  loginSchema,
  okSchema,
  resetSchema,
  sessionSchema,
  signupSchema,
  verifiedSchema,
} from "./authSchemas";
import type { AuthSession, LoginResponse, SignupResponse } from "./authSchemas";

interface FetchInput { readonly fetcher?: PlatformFetch }
interface EmailInput extends FetchInput { readonly email: string }
interface PasswordInput extends EmailInput { readonly password: string }
interface TokenInput extends FetchInput { readonly token: string }
interface PasswordTokenInput extends TokenInput {
  readonly newPassword: string;
  readonly newPasswordConfirmation: string;
}

const jsonRequest = (method: string, body?: object, signal?: AbortSignal): RequestInit => ({
  ...(body === undefined ? {} : {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }),
  method,
  ...(signal === undefined ? {} : { signal }),
});

const fetchOption = (fetcher: PlatformFetch | undefined): { fetcher?: PlatformFetch } => (
  fetcher === undefined ? {} : { fetcher }
);

export const getSession = async (input: FetchInput & { readonly signal?: AbortSignal }): Promise<AuthSession> =>
  requestPlatformJson({
    ...fetchOption(input.fetcher),
    init: jsonRequest("GET", undefined, input.signal),
    path: "/session",
    responseSchema: sessionSchema,
  });

export const login = async (input: PasswordInput): Promise<LoginResponse> => requestPlatformJson({
  ...fetchOption(input.fetcher),
  init: jsonRequest("POST", { email: input.email, password: input.password }),
  path: "/sessions",
  responseSchema: loginSchema,
});

interface SignupInput extends PasswordInput {
  readonly invitationToken?: string;
  readonly returnTo: string;
}

export const createAccount = async (input: SignupInput): Promise<SignupResponse> => requestPlatformJson({
  ...fetchOption(input.fetcher),
  init: jsonRequest("POST", {
    email: input.email,
    ...(input.invitationToken === undefined ? {} : { invitationToken: input.invitationToken }),
    password: input.password,
    returnTo: input.returnTo,
  }),
  path: "/accounts",
  responseSchema: signupSchema,
});

export const requestEmailVerification = async (
  input: EmailInput & { readonly returnTo: string },
): Promise<string> => {
  const response = await requestPlatformJson({
    ...fetchOption(input.fetcher),
    init: jsonRequest("POST", { email: input.email, returnTo: input.returnTo }),
    path: "/email-verifications",
    responseSchema: acceptedSchema,
  });
  return response.message;
};

export const verifyEmail = async (input: PasswordTokenInput): Promise<boolean> => {
  const response = await requestPlatformJson({
    ...fetchOption(input.fetcher),
    init: jsonRequest("POST", {
      token: input.token,
      newPassword: input.newPassword,
      newPasswordConfirmation: input.newPasswordConfirmation,
    }),
    path: "/email-verifications/consume",
    responseSchema: verifiedSchema,
  });
  return response.verified;
};

export const requestPasswordReset = async (input: EmailInput): Promise<string> => {
  const response = await requestPlatformJson({
    ...fetchOption(input.fetcher),
    init: jsonRequest("POST", { email: input.email }),
    path: "/password-resets",
    responseSchema: acceptedSchema,
  });
  return response.message;
};

export const resetPassword = async (input: PasswordTokenInput): Promise<boolean> => {
  const response = await requestPlatformJson({
    ...fetchOption(input.fetcher),
    init: jsonRequest("POST", {
      newPassword: input.newPassword,
      newPasswordConfirmation: input.newPasswordConfirmation,
      token: input.token,
    }),
    path: "/password-resets/consume",
    responseSchema: resetSchema,
  });
  return response.reset;
};

interface ChangePasswordInput extends FetchInput {
  readonly currentPassword: string;
  readonly newPassword: string;
  readonly newPasswordConfirmation: string;
}

export const changePassword = async (input: ChangePasswordInput): Promise<boolean> => {
  const response = await requestPlatformJson({
    ...fetchOption(input.fetcher),
    init: jsonRequest("PUT", {
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
      newPasswordConfirmation: input.newPasswordConfirmation,
    }),
    path: "/session/password",
    responseSchema: okSchema,
  });
  return response.ok;
};

export const logout = async (input: FetchInput = {}): Promise<boolean> => {
  const response = await requestPlatformJson({
    ...fetchOption(input.fetcher),
    init: jsonRequest("DELETE"),
    path: "/session",
    responseSchema: okSchema,
  });
  return response.ok;
};
