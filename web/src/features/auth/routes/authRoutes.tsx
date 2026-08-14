import type { LoaderFunctionArgs, RouteObject } from "react-router-dom";
import { getSignupConfiguration } from "../api/signupApi";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage/ForgotPasswordPage";
import { LoginPage } from "../pages/LoginPage/LoginPage";
import { ResetPasswordPage } from "../pages/ResetPasswordPage/ResetPasswordPage";
import { SignupPage } from "../pages/SignupPage/SignupPage";
import type { VerificationResult } from "../pages/VerifyEmailPage/VerifyEmailPage";
import { VerifyEmailRoute } from "./VerifyEmailRoute";

export const verifyEmailLoader = ({ request }: LoaderFunctionArgs): VerificationResult => {
  const token = new URL(request.url).searchParams.get("token");
  if (token === null) return { status: "request" };
  return { status: "setup", token };
};

export const signupLoader = () => getSignupConfiguration();

export const authRoutes: RouteObject[] = [
  { path: "/login", Component: LoginPage },
  { path: "/signup", Component: SignupPage, loader: signupLoader },
  { path: "/forgot-password", Component: ForgotPasswordPage },
  { path: "/reset-password", Component: ResetPasswordPage },
  { path: "/verify-email", Component: VerifyEmailRoute, loader: verifyEmailLoader },
];
