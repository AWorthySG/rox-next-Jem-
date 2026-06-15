// Day/night cycle and dynamic weather. The engine advances a single global
// `timeOfDay` (0..1, 0 = midnight, 0.5 = noon) and re-rolls a `weather` state
// every few minutes. Both are broadcast to clients for visuals AND feed combat:
// an attack's element is amplified or dampened by the current sky.
import { Element } from "./elements.js";

export enum Weather {
  Clear = "clear",
  Rain = "rain",
  Fog = "fog",
  Storm = "storm",
  Snow = "snow",
}

export const WEATHERS: Weather[] = [Weather.Clear, Weather.Rain, Weather.Fog, Weather.Storm, Weather.Snow];

export const WEATHER_LABEL: Record<Weather, string> = {
  [Weather.Clear]: "Clear Skies",
  [Weather.Rain]: "Rain",
  [Weather.Fog]: "Fog",
  [Weather.Storm]: "Thunderstorm",
  [Weather.Snow]: "Snowfall",
};

export const WEATHER_ICON: Record<Weather, string> = {
  [Weather.Clear]: "☀️",
  [Weather.Rain]: "🌧️",
  [Weather.Fog]: "🌫️",
  [Weather.Storm]: "⛈️",
  [Weather.Snow]: "❄️",
};

// Full day length and how often weather re-rolls (real time).
export const DAY_LENGTH_MS = 8 * 60 * 1000; // 8-minute day/night cycle
export const WEATHER_PERIOD_MS = 2 * 60 * 1000; // re-roll weather every 2 minutes

// Weighted weather table — mostly clear, occasional spells.
const WEATHER_WEIGHTS: Array<[Weather, number]> = [
  [Weather.Clear, 50],
  [Weather.Rain, 18],
  [Weather.Fog, 14],
  [Weather.Storm, 9],
  [Weather.Snow, 9],
];

export function rollWeather(rng: () => number = Math.random): Weather {
  const total = WEATHER_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [weather, w] of WEATHER_WEIGHTS) {
    if ((r -= w) <= 0) return weather;
  }
  return Weather.Clear;
}

// Night when the sun is down (roughly before 6am / after 6pm).
export function isNight(timeOfDay: number): boolean {
  return timeOfDay < 0.25 || timeOfDay >= 0.75;
}

// 0 at midnight → 1 at noon → 0 at midnight; drives sun brightness.
export function daylight(timeOfDay: number): number {
  return Math.max(0, Math.sin(timeOfDay * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5);
}

// How strongly the current sky amplifies (or dampens) an attack of `element`.
// Shadow thrives at night, Holy by day; Water/Wind surge in rain and storms;
// Fire is dampened when wet. Returns a single multiplier (≈0.8 … 1.25).
export function environmentMultiplier(element: Element, timeOfDay: number, weather: Weather): number {
  let mult = 1;
  const night = isNight(timeOfDay);
  if (element === Element.Shadow) mult *= night ? 1.15 : 0.9;
  if (element === Element.Holy) mult *= night ? 0.9 : 1.15;
  switch (weather) {
    case Weather.Rain:
      if (element === Element.Water) mult *= 1.15;
      if (element === Element.Fire) mult *= 0.85;
      break;
    case Weather.Storm:
      if (element === Element.Wind) mult *= 1.2;
      if (element === Element.Water) mult *= 1.1;
      if (element === Element.Fire) mult *= 0.85;
      break;
    case Weather.Snow:
      if (element === Element.Water) mult *= 1.15;
      if (element === Element.Fire) mult *= 0.8;
      break;
    case Weather.Fog:
      if (element === Element.Holy || element === Element.Shadow) mult *= 0.92;
      break;
    case Weather.Clear:
      break;
  }
  return Math.round(mult * 100) / 100;
}
