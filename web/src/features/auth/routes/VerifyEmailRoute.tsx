import { useLoaderData } from "react-router-dom";
import { VerifyEmailPage } from "../pages/VerifyEmailPage/VerifyEmailPage";
import type { VerificationResult } from "../pages/VerifyEmailPage/VerifyEmailPage";

export const VerifyEmailRoute = () => {
  const result = useLoaderData<VerificationResult>();
  return <VerifyEmailPage result={result} />;
};
