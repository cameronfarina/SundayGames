import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AuthSession } from "../../auth/api/authSchemas";
import { sessionQueryKey } from "../../auth/api/sessionQuery";
import {
  saveAccountOnboarding,
  type AccountOnboardingAction,
} from "../api/accountOnboardingApi";

export const useAccountOnboardingMutation = (accountId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: AccountOnboardingAction) => saveAccountOnboarding(accountId, action),
    onSuccess: ({ onboarding }) => {
      queryClient.setQueryData<AuthSession>(sessionQueryKey(), current => {
        if (current?.account.id !== accountId) return current;
        return { ...current, onboarding };
      });
    },
  });
};
