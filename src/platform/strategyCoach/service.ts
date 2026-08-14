import { buildStrategyCoachPlan } from "./buildPlan.js";
import type {
  StrategyCoachConversation,
  StrategyCoachService,
} from "./contracts.js";
import { stableId } from "./identity.js";
import { InMemoryStrategyCoachRepository } from "./repository.js";

const now = (): Date => new Date();

export const createStrategyCoachService = (
  repository = new InMemoryStrategyCoachRepository(),
): StrategyCoachService => ({
  createPlanFromPrompt(input) {
    const createdAt = input.createdAt ?? now();
    const conversationId = input.conversationId ?? stableId("coach_conversation", {
      userId: input.userId,
      leagueId: input.leagueId,
      seasonId: input.seasonId,
      privateOwnerUserId: input.privateOwnerUserId,
      promptText: input.promptText,
      createdAt: createdAt.toISOString(),
    });
    const plan = buildStrategyCoachPlan({ ...input, createdAt, conversationId });
    const conversation: StrategyCoachConversation = {
      id: conversationId,
      userId: input.userId,
      leagueId: input.leagueId,
      seasonId: input.seasonId,
      privateOwnerUserId: input.privateOwnerUserId,
      owner: input.owner,
      promptText: input.promptText,
      messages: [
        {
          id: stableId("coach_message", {
            conversationId,
            role: "user",
            content: input.promptText,
            createdAt,
          }),
          conversationId,
          role: "user",
          content: input.promptText,
          createdAt,
        },
        {
          id: stableId("coach_message", {
            conversationId,
            role: "assistant",
            planId: plan.id,
            createdAt,
          }),
          conversationId,
          role: "assistant",
          content: `Built ${plan.variants.length} deterministic strategy plan variant${plan.variants.length === 1 ? "" : "s"}.`,
          createdAt,
          planId: plan.id,
        },
      ],
      planIds: [plan.id],
      createdAt,
    };

    return {
      conversation: repository.saveConversation(conversation),
      plan: repository.savePlan(plan),
    };
  },
  getConversationForUser(userId, conversationId) {
    return repository.getConversationForUser(userId, conversationId);
  },
  getPlanForUser(userId, planId) {
    return repository.getPlanForUser(userId, planId);
  },
  listConversationsForUser(userId, leagueId, seasonId) {
    return repository.listConversationsForUser(userId, leagueId, seasonId);
  },
  listPlansForUser(userId, leagueId, seasonId) {
    return repository.listPlansForUser(userId, leagueId, seasonId);
  },
});
