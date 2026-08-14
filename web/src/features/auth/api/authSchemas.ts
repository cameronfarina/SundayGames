import { z } from "zod";

export const accountSchema = z.object({
  createdAt: z.string(),
  email: z.email(),
  emailVerifiedAt: z.string().optional(),
  id: z.string().min(1),
  updatedAt: z.string(),
});

const publicSessionSchema = z.object({
  accountId: z.string().min(1),
  createdAt: z.string(),
  expiresAt: z.string(),
  id: z.string().min(1),
  revokedAt: z.string().optional(),
});

export const sessionSchema = z.object({ account: accountSchema });

export const loginSchema = z.object({
  account: accountSchema,
  session: publicSessionSchema,
});

export const signupSchema = z.union([
  z.object({ account: accountSchema }),
  z.object({ accepted: z.literal(true), message: z.string().min(1) }),
]);

export const signupConfigurationSchema = z.object({ passwordRequired: z.boolean() });

export const acceptedSchema = z.object({
  accepted: z.literal(true),
  message: z.string().min(1),
});

export const verifiedSchema = z.object({ verified: z.literal(true) });
export const resetSchema = z.object({ reset: z.literal(true) });
export const okSchema = z.object({ ok: z.literal(true) });

export type AuthAccount = z.infer<typeof accountSchema>;
export type AuthSession = z.infer<typeof sessionSchema>;
export type LoginResponse = z.infer<typeof loginSchema>;
export type SignupResponse = z.infer<typeof signupSchema>;
export type SignupConfiguration = z.infer<typeof signupConfigurationSchema>;
