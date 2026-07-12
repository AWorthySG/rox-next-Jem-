// Competitive rankings — a scoring layer over content the game already has.
// Players earn MVP-hunt points from slaying boss / world-boss monsters, and
// guilds earn siege points from capturing the castle. Both are surfaced as
// leaderboards on the Hall of Glory board.
export interface RankingEntry {
  name: string;
  score: number;
}

export const SIEGE_WIN_POINTS = 100; // guild ladder points for capturing the castle
export const RANKING_BOARD_SIZE = 10; // entries shown per leaderboard

// Points a single MVP kill is worth: world bosses (raid-tier) are worth their
// full level, ordinary MVPs half — so tougher hunts climb the board faster.
export function mvpKillPoints(level: number, worldBoss: boolean): number {
  return worldBoss ? Math.max(5, level) : Math.max(1, Math.ceil(level / 2));
}
