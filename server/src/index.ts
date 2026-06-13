import { DEFAULT_PORT } from "@rox/shared";
import { World, GameLoop } from "@rox/engine";
import { WsGateway } from "./net/WsGateway.js";

const port = Number(process.env.PORT) || DEFAULT_PORT;

const world = new World();
const loop = new GameLoop(world);
const gateway = new WsGateway(world, port);

loop.start();
console.log(`[server] ROX-Next authoritative server started (tick loop running)`);

function shutdown(): void {
  console.log("[server] shutting down");
  loop.stop();
  gateway.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
