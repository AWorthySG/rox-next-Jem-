import { DAY_LENGTH_MS, rollWeather, WEATHER_ICON, WEATHER_LABEL, WEATHER_PERIOD_MS, MsgType } from "@rox/shared";
import type { World } from "./World.js";

// Advances the global day/night clock and re-rolls weather periodically, then
// broadcasts the sky state to every connected client (throttled to ~0.5 Hz —
// the client interpolates between updates).
const BROADCAST_EVERY_MS = 2000;

export class TimeWeatherSystem {
  private weatherTimer = WEATHER_PERIOD_MS;
  private broadcastTimer = 0;

  constructor(private world: World) {}

  update(dtMs: number): void {
    this.world.timeOfDay = (this.world.timeOfDay + dtMs / DAY_LENGTH_MS) % 1;

    this.weatherTimer -= dtMs;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = WEATHER_PERIOD_MS;
      const next = rollWeather();
      if (next !== this.world.weather) {
        this.world.weather = next;
        this.broadcastTimer = 0; // push the change out immediately
        this.world.broadcast({
          t: MsgType.ChatBroadcast,
          fromId: 0,
          name: "Sky",
          text: `${WEATHER_ICON[next]} The weather turns to ${WEATHER_LABEL[next]}.`,
        });
      }
    }

    this.broadcastTimer -= dtMs;
    if (this.broadcastTimer <= 0) {
      this.broadcastTimer = BROADCAST_EVERY_MS;
      this.world.broadcast(this.world.worldStateMsg());
    }
  }
}
