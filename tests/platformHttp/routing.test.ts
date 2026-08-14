import { describe, it } from "./support/index.js";
import { createRoutingContext } from "./slices/routingContext.js";
import { verifyRoutingLiveRoomCompletion } from "./slices/routingLiveRoomCompletion.js";
import { verifyRoutingLiveRoomLifecycle } from "./slices/routingLiveRoomLifecycle.js";
import { verifyRoutingLiveRoomSales } from "./slices/routingLiveRoomSales.js";
import { verifyRoutingMockSession } from "./slices/routingMockSession.js";
import { verifyRoutingSeasonAndPricing } from "./slices/routingSeasonAndPricing.js";
import { verifyRoutingSimulationJobs } from "./slices/routingSimulationJobs.js";

describe("platform HTTP contract", () => {
  it("routes season, simulation, mock session, live room, and export calls through PlatformApp", async () => {
    const context = await createRoutingContext();
    await verifyRoutingSeasonAndPricing(context);
    const sethSimulationId = await verifyRoutingSimulationJobs(context);
    await verifyRoutingMockSession(context, sethSimulationId);
    await verifyRoutingLiveRoomLifecycle(context);
    await verifyRoutingLiveRoomSales(context);
    await verifyRoutingLiveRoomCompletion(context);
  });
});
