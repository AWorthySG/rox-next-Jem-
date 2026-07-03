// Maps that get an ocean around the island: [shallow, deep] water colours.
// Shared by SceneManager (builds the water plane) and scenery (adds piers).
export const WATER_MAPS: Record<string, [number, number]> = {
  comodo: [0x6fd0e0, 0x12586f],
  abyss: [0x3a8fb0, 0x081f2e],
  merlion_bay: [0x7fdce8, 0x1a6a8a],
  sentosa: [0x7fe0e8, 0x1a7090],
  east_coast: [0x7fd8e0, 0x1a6884],
  changi: [0x7fdce4, 0x1a6a88],
  macritchie: [0x4a9a6a, 0x14483a],
  sungei_buloh: [0x6a9a6a, 0x244a2a],
  kusu_island: [0x7fe0e8, 0x1a7090],
  botanic_gardens: [0x6abada, 0x1e5a7a],
  labrador_park: [0x7fd0e0, 0x1a6080],
  coney_island: [0x7fd8d8, 0x1e6470],
  punggol_waterway: [0x6fc8d0, 0x1a5a78],
  pasir_ris: [0x7fd8d0, 0x1e6470],
  marina_barrage: [0x6fb0d0, 0x143a5a],
  the_float: [0x5a9ad0, 0x0a2a5a],
};
