import type {
  StrategyCoachConversation,
  StrategyCoachPlan,
} from "./contracts.js";

const clone = <T>(value: T): T => structuredClone(value);

export class InMemoryStrategyCoachRepository {
  readonly #conversationsById = new Map<string, StrategyCoachConversation>();
  readonly #plansById = new Map<string, StrategyCoachPlan>();

  saveConversation(conversation: StrategyCoachConversation): StrategyCoachConversation {
    const stored = clone(conversation);
    this.#conversationsById.set(stored.id, stored);
    return clone(stored);
  }

  savePlan(plan: StrategyCoachPlan): StrategyCoachPlan {
    const stored = clone(plan);
    this.#plansById.set(stored.id, stored);
    return clone(stored);
  }

  getConversationForUser(userId: string, conversationId: string): StrategyCoachConversation | null {
    const conversation = this.#conversationsById.get(conversationId);
    if (conversation === undefined || conversation.privateOwnerUserId !== userId) return null;
    return clone(conversation);
  }

  getPlanForUser(userId: string, planId: string): StrategyCoachPlan | null {
    const plan = this.#plansById.get(planId);
    if (plan === undefined || plan.privateOwnerUserId !== userId) return null;
    return clone(plan);
  }

  listConversationsForUser(
    userId: string,
    leagueId?: string,
    seasonId?: string,
  ): StrategyCoachConversation[] {
    return [...this.#conversationsById.values()]
      .filter(conversation =>
        conversation.privateOwnerUserId === userId &&
        (leagueId === undefined || conversation.leagueId === leagueId) &&
        (seasonId === undefined || conversation.seasonId === seasonId))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map(clone);
  }

  listPlansForUser(userId: string, leagueId?: string, seasonId?: string): StrategyCoachPlan[] {
    return [...this.#plansById.values()]
      .filter(plan =>
        plan.privateOwnerUserId === userId &&
        (leagueId === undefined || plan.leagueId === leagueId) &&
        (seasonId === undefined || plan.seasonId === seasonId))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map(clone);
  }
}
