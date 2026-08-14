import type { LoaderFunctionArgs, RouteObject } from "react-router-dom";
import { verifyEmail } from "../api/authApi";
import { authErrorMessage } from "../model/authErrorMessage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage/ForgotPasswordPage";
import { LoginPage } from "../pages/LoginPage/LoginPage";
import { ResetPasswordPage } from "../pages/ResetPasswordPage/ResetPasswordPage";
import { SignupPage } from "../pages/SignupPage/SignupPage";
import type { VerificationResult } from "../pages/VerifyEmailPage/VerifyEmailPage";
import { VerifyEmailRoute } from "./VerifyEmailRoute";

export const verifyEmailLoader = async ({ request }: LoaderFunctionArgs): Promise<VerificationResult> => {
  const token = new URL(request.url).searchParams.get("token");
  if (token === null) return { status: "request" };
  try {
    await verifyEmail({ token });
    return { status: "verified" };
  } catch (error: unknown) {
    return { message: authErrorMessage(error), status: "error" };
  }
};

export const authRoutes: RouteObject[] = [
  { path: "/login", Component: LoginPage },
  { path: "/signup", Component: SignupPage },
  { path: "/forgot-password", Component: ForgotPasswordPage },
  { path: "/reset-password", Component: ResetPasswordPage },
  { path: "/verify-email", Component: VerifyEmailRoute, loader: verifyEmailLoader },
];
