import "./platform-readiness/localWorkspace.case.js";
import "./platform-readiness/draftLab.cases.js";
import "./platform-readiness/navigation.case.js";
import "./platform-readiness/staleMock.case.js";
import "./platform-readiness/completedMock.case.js";
import "./platform-readiness/finalSlot.case.js";
import "./platform-readiness/keeperHistory.case.js";
import "./platform-readiness/staleSetup.case.js";
import "./platform-readiness/deployedWorkspace.case.js";
import { assertPlatformReadinessParity } from "./support/platform-readiness/parityGuard.js";

assertPlatformReadinessParity();
