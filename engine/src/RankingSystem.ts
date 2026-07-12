import { mvpKillPoints, RANKING_BOARD_SIZE, SIEGE_WIN_POINTS, type RankingEntry } from "@rox/shared";
import type { Player } from "./Player.js";
import type { Monster } from "./Monster.js";
import type { Guild } from "./GuildSystem.js";

const SEASON_NAME = "Season of Valor";

interface ScoreRow {
  name: string; // snapshot so the row survives logout / disband
  score: number;
}

// The Hall of Glory rankings — two seasonal leaderboards layered over content
// the game already has. Players earn MVP-hunt points from boss kills; guilds
// earn siege points from capturing the castle. Scores are kept in-memory keyed
// by the entity id, with a name snapshot so a board entry outlives the player
// logging off or the guild disbanding.
export class RankingSystem {
  private mvp = new Map<number, ScoreRow>(); // playerId -> row
  private siege = new Map<number, ScoreRow>(); // guildId -> row

  get season(): string {
    return SEASON_NAME;
  }

  // Credit an MVP kill to the finishing player, weighted by the boss's tier.
  recordMvpKill(player: Player, monster: Monster): void {
    if (!monster.template.boss) return;
    const points = mvpKillPoints(monster.template.level, !!monster.template.worldBoss);
    const row = this.mvp.get(player.id);
    if (row) {
      row.name = player.name;
      row.score += points;
    } else {
      this.mvp.set(player.id, { name: player.name, score: points });
    }
  }

  // Credit a castle capture to the victorious guild.
  recordSiegeWin(guild: Guild): void {
    const row = this.siege.get(guild.id);
    if (row) {
      row.name = guild.name;
      row.score += SIEGE_WIN_POINTS;
    } else {
      this.siege.set(guild.id, { name: guild.name, score: SIEGE_WIN_POINTS });
    }
  }

  mvpBoard(): RankingEntry[] {
    return this.board(this.mvp);
  }

  siegeBoard(): RankingEntry[] {
    return this.board(this.siege);
  }

  // A player's own MVP-hunt score (0 if unranked).
  mvpScoreOf(playerId: number): number {
    return this.mvp.get(playerId)?.score ?? 0;
  }

  private board(scores: Map<number, ScoreRow>): RankingEntry[] {
    return [...scores.values()]
      .map((r) => ({ name: r.name, score: r.score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, RANKING_BOARD_SIZE);
  }
}
