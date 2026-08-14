import { describe } from "vitest";
import { registerArchitectureTest } from "./platformSeasonSimulationEngine/architecture.js";
import { registerAuctionBudgetTests } from "./platformSeasonSimulationEngine/auctionBudgets.js";
import { registerAuctionCapTests } from "./platformSeasonSimulationEngine/auctionCaps.js";
import { registerAuctionNominationTests } from "./platformSeasonSimulationEngine/auctionNomination.js";
import { registerDeterministicAuctionTests } from "./platformSeasonSimulationEngine/deterministicAuction.js";
import { registerEliteAuctionTests } from "./platformSeasonSimulationEngine/eliteAuction.js";
import { registerLargeLeagueTests } from "./platformSeasonSimulationEngine/largeLeague.js";
import { registerPlayerNameErrorTests } from "./platformSeasonSimulationEngine/playerNameErrors.js";
import { registerPlayerNameResolutionTests } from "./platformSeasonSimulationEngine/playerNameResolution.js";
import { registerProductionTargetTests } from "./platformSeasonSimulationEngine/productionTargets.js";
import { registerProgressAndLineupTests } from "./platformSeasonSimulationEngine/progressAndLineups.js";
import { registerRosterDisciplineTests } from "./platformSeasonSimulationEngine/rosterDiscipline.js";
import { registerSavedTargetPriorityTests } from "./platformSeasonSimulationEngine/savedTargetPriority.js";
import { registerSnakeSimulationTests } from "./platformSeasonSimulationEngine/snakeSimulation.js";
import { registerStrategyParserPreferenceTests } from "./platformSeasonSimulationEngine/strategyParserPreferences.js";
import { registerStrategyParserTargetTests } from "./platformSeasonSimulationEngine/strategyParserTargets.js";
import { registerStrategyPrecedenceAndValueTests } from "./platformSeasonSimulationEngine/strategyPrecedenceAndValues.js";
import { registerTargetAvailabilityTests } from "./platformSeasonSimulationEngine/targetAvailability.js";
import { registerTargetBudgetPlanTests } from "./platformSeasonSimulationEngine/targetBudgetPlans.js";
import { registerValidationTests } from "./platformSeasonSimulationEngine/validation.js";

describe("season simulation strategy parser", () => {
  registerStrategyParserTargetTests();
  registerStrategyParserPreferenceTests();
});

describe("season simulation runner", () => {
  registerTargetAvailabilityTests();
  registerTargetBudgetPlanTests();
  registerProgressAndLineupTests();
  registerDeterministicAuctionTests();
  registerPlayerNameResolutionTests();
  registerPlayerNameErrorTests();
  registerSavedTargetPriorityTests();
  registerProductionTargetTests();
  registerStrategyPrecedenceAndValueTests();
  registerRosterDisciplineTests();
  registerAuctionNominationTests();
  registerAuctionCapTests();
  registerEliteAuctionTests();
  registerAuctionBudgetTests();
  registerSnakeSimulationTests();
  registerValidationTests();
  registerLargeLeagueTests();
});

describe("season simulation test architecture", registerArchitectureTest);
