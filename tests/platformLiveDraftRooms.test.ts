import { assertLiveDraftRoomSuiteParity } from "./platformLiveDraftRooms/parityGuard.js";
import "./platformLiveDraftRooms/01-roomSetupCancellation.suite.js";
import "./platformLiveDraftRooms/02-roomCreation.suite.js";
import "./platformLiveDraftRooms/03-rosterSynchronization.suite.js";
import "./platformLiveDraftRooms/04-playerCatalogValidation.suite.js";
import "./platformLiveDraftRooms/05-mutationMetadata.suite.js";
import "./platformLiveDraftRooms/06-saleCommands.suite.js";
import "./platformLiveDraftRooms/07-saleIntegrity.suite.js";
import "./platformLiveDraftRooms/08-initialRosterValidation.suite.js";
import "./platformLiveDraftRooms/09-rosterCapacity.suite.js";
import "./platformLiveDraftRooms/10-slotAndBudgetValidation.suite.js";
import "./platformLiveDraftRooms/11-roomAccessAndPause.suite.js";
import "./platformLiveDraftRooms/12-saleCorrection.suite.js";
import "./platformLiveDraftRooms/13-roomCompletion.suite.js";
import "./platformLiveDraftRooms/14-saleAliases.suite.js";

assertLiveDraftRoomSuiteParity(import.meta.url);
