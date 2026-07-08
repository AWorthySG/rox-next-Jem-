import {
  COUPLE_EXP_BONUS,
  MENTOR_GRADUATE_LEVEL,
  MENTOR_MAX_STUDENTS,
  MENTOR_MIN_LEVEL_GAP,
  MENTOR_STUDENT_EXP_BONUS,
  MENTOR_TEACH_EXP_BONUS,
  MENTOR_VALUE_PER_KILL,
  MsgType,
  SOCIAL_BOND_RANGE,
  type SocialInfo,
} from "@rox/shared";
import type { World } from "./World.js";
import type { Player } from "./Player.js";

function dist2d(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}

// Social bonds — mentorship and couples. A veteran mentors newcomers (a mentor
// holds up to MENTOR_MAX_STUDENTS; a student has one mentor and graduates at
// MENTOR_GRADUATE_LEVEL), and any two players may pair up as a couple. Bonded
// players who fight near one another earn bonus EXP (applied in CombatSystem);
// shared kills also build a mentorship's value. All state is in-memory, like
// parties and guilds.
export class SocialSystem {
  private mentorOf = new Map<number, number>(); // studentId -> mentorId
  private studentsOf = new Map<number, Set<number>>(); // mentorId -> studentIds
  private partnerOf = new Map<number, number>(); // playerId -> partnerId (symmetric)
  private value = new Map<number, number>(); // studentId -> mentorship value

  private pendingMentor = new Map<number, number>(); // mentorId -> studentId
  private pendingCouple = new Map<number, number>(); // proposerId -> targetId

  constructor(private world: World) {}

  // ---- lookups ----

  mentorIdOf(studentId: number): number | null {
    return this.mentorOf.get(studentId) ?? null;
  }

  partnerIdOf(playerId: number): number | null {
    return this.partnerOf.get(playerId) ?? null;
  }

  studentsList(mentorId: number): number[] {
    return [...(this.studentsOf.get(mentorId) ?? [])];
  }

  // ---- mentorship ----

  requestMentor(mentor: Player, studentId: number): void {
    if (mentor.id === studentId) return;
    const student = this.world.players.get(studentId);
    if (!student || student.mapId !== mentor.mapId) return;
    if (this.mentorOf.has(studentId)) return; // already has a mentor
    if ((this.studentsOf.get(mentor.id)?.size ?? 0) >= MENTOR_MAX_STUDENTS) return;
    if (mentor.level < student.level + MENTOR_MIN_LEVEL_GAP) return; // must outrank enough
    if (student.level >= MENTOR_GRADUATE_LEVEL) return; // too senior to be a student
    this.pendingMentor.set(mentor.id, studentId);
    this.world.connections.get(student.connId)?.send({
      t: MsgType.SocialRequestRecv,
      kind: "mentor",
      fromId: mentor.id,
      fromName: mentor.name,
    });
  }

  acceptMentor(student: Player, mentorId: number): void {
    if (this.pendingMentor.get(mentorId) !== student.id) return;
    this.pendingMentor.delete(mentorId);
    const mentor = this.world.players.get(mentorId);
    if (!mentor || this.mentorOf.has(student.id)) return;
    if ((this.studentsOf.get(mentor.id)?.size ?? 0) >= MENTOR_MAX_STUDENTS) return;
    this.mentorOf.set(student.id, mentor.id);
    let set = this.studentsOf.get(mentor.id);
    if (!set) this.studentsOf.set(mentor.id, (set = new Set()));
    set.add(student.id);
    this.value.set(student.id, 0);
    this.announce(mentor.mapId, "Mentorship", `${mentor.name} is now mentoring ${student.name}!`);
    this.sync(mentor);
    this.sync(student);
  }

  // Dissolve a student's mentorship (called on leave, graduation, or disconnect).
  private dissolveMentorship(studentId: number): void {
    const mentorId = this.mentorOf.get(studentId);
    if (mentorId == null) return;
    this.mentorOf.delete(studentId);
    this.value.delete(studentId);
    this.studentsOf.get(mentorId)?.delete(studentId);
    const mentor = this.world.players.get(mentorId);
    const student = this.world.players.get(studentId);
    if (mentor) this.sync(mentor);
    if (student) this.sync(student);
  }

  // ---- couples ----

  requestCouple(from: Player, targetId: number): void {
    if (from.id === targetId) return;
    const target = this.world.players.get(targetId);
    if (!target || target.mapId !== from.mapId) return;
    if (this.partnerOf.has(from.id) || this.partnerOf.has(targetId)) return; // already paired
    this.pendingCouple.set(from.id, targetId);
    this.world.connections.get(target.connId)?.send({
      t: MsgType.SocialRequestRecv,
      kind: "couple",
      fromId: from.id,
      fromName: from.name,
    });
  }

  acceptCouple(target: Player, fromId: number): void {
    if (this.pendingCouple.get(fromId) !== target.id) return;
    this.pendingCouple.delete(fromId);
    const proposer = this.world.players.get(fromId);
    if (!proposer || this.partnerOf.has(fromId) || this.partnerOf.has(target.id)) return;
    this.partnerOf.set(fromId, target.id);
    this.partnerOf.set(target.id, fromId);
    this.announce(target.mapId, "Couple", `${proposer.name} and ${target.name} are now partners! 💞`);
    this.sync(proposer);
    this.sync(target);
  }

  private dissolveCouple(playerId: number): void {
    const partnerId = this.partnerOf.get(playerId);
    if (partnerId == null) return;
    this.partnerOf.delete(playerId);
    this.partnerOf.delete(partnerId);
    const a = this.world.players.get(playerId);
    const b = this.world.players.get(partnerId);
    if (a) this.sync(a);
    if (b) this.sync(b);
  }

  // ---- outbound leave (explicit or on disconnect) ----

  leaveMentor(player: Player): void {
    // Either a student leaving their mentor, or a mentor releasing all students.
    if (this.mentorOf.has(player.id)) this.dissolveMentorship(player.id);
    for (const studentId of this.studentsList(player.id)) this.dissolveMentorship(studentId);
  }

  leaveCouple(player: Player): void {
    this.dissolveCouple(player.id);
  }

  // Full teardown when a player disconnects: drop pending requests and bonds.
  onDisconnect(player: Player): void {
    this.pendingMentor.delete(player.id);
    this.pendingCouple.delete(player.id);
    for (const [reqId, tgtId] of this.pendingMentor) if (tgtId === player.id) this.pendingMentor.delete(reqId);
    for (const [reqId, tgtId] of this.pendingCouple) if (tgtId === player.id) this.pendingCouple.delete(reqId);
    this.leaveMentor(player);
    this.leaveCouple(player);
  }

  // ---- combat hooks ----

  // The bonus EXP multiplier `player` earns from bonded partners fighting near
  // them (couple + mentorship). Stacks additively; 1.0 = no bonded bonus.
  expMultiplier(player: Player): number {
    let m = 1;
    const partnerId = this.partnerOf.get(player.id);
    if (partnerId != null && this.near(player, partnerId)) m += COUPLE_EXP_BONUS;
    const mentorId = this.mentorOf.get(player.id);
    if (mentorId != null && this.near(player, mentorId)) m += MENTOR_STUDENT_EXP_BONUS;
    for (const studentId of this.studentsOf.get(player.id) ?? []) {
      if (this.near(player, studentId)) {
        m += MENTOR_TEACH_EXP_BONUS;
        break;
      }
    }
    return m;
  }

  // On a kill credited to `player`: build mentorship value when mentor + student
  // fought together, and graduate a student who has reached the cap.
  onKill(player: Player): void {
    const mentorId = this.mentorOf.get(player.id);
    if (mentorId != null && this.near(player, mentorId)) {
      this.value.set(player.id, (this.value.get(player.id) ?? 0) + MENTOR_VALUE_PER_KILL);
      const mentor = this.world.players.get(mentorId);
      if (mentor) this.sync(mentor);
      this.sync(player);
    }
    for (const studentId of this.studentsOf.get(player.id) ?? []) {
      if (this.near(player, studentId)) {
        this.value.set(studentId, (this.value.get(studentId) ?? 0) + MENTOR_VALUE_PER_KILL);
        const student = this.world.players.get(studentId);
        if (student) this.sync(student);
      }
    }
    if (this.mentorOf.has(player.id) && player.level >= MENTOR_GRADUATE_LEVEL) this.graduate(player);
  }

  private graduate(student: Player): void {
    const mentorId = this.mentorOf.get(student.id);
    const mentor = mentorId != null ? this.world.players.get(mentorId) : undefined;
    // Both sides earn a graduation reward (the real game's Gold Medals / Mentor Medals).
    student.addItem("emperium_fragment", 2);
    student.zeny += 3000;
    this.world.connections.get(student.connId)?.send({ t: MsgType.Loot, items: [{ id: "emperium_fragment", qty: 2 }], zeny: 3000 });
    if (mentor) {
      mentor.addItem("emperium_fragment", 3);
      mentor.zeny += 5000;
      this.world.connections.get(mentor.connId)?.send({ t: MsgType.Loot, items: [{ id: "emperium_fragment", qty: 3 }], zeny: 5000 });
    }
    this.world.broadcast({
      t: MsgType.ChatBroadcast,
      fromId: 0,
      name: "Mentorship",
      text: `🎓 ${student.name} has graduated${mentor ? ` under ${mentor.name}` : ""}!`,
    });
    this.dissolveMentorship(student.id);
  }

  // ---- helpers ----

  private near(player: Player, otherId: number): boolean {
    const other = this.world.players.get(otherId);
    return !!other && other.mapId === player.mapId && dist2d(player.x, player.z, other.x, other.z) <= SOCIAL_BOND_RANGE;
  }

  private announce(mapId: string, name: string, text: string): void {
    this.world.broadcastToMap(mapId, { t: MsgType.ChatBroadcast, fromId: 0, name, text });
  }

  info(player: Player): SocialInfo {
    const mentorId = this.mentorOf.get(player.id) ?? null;
    const mentor = mentorId != null ? this.world.players.get(mentorId) : undefined;
    const partnerId = this.partnerOf.get(player.id) ?? null;
    const partner = partnerId != null ? this.world.players.get(partnerId) : undefined;
    const students = this.studentsList(player.id)
      .map((id) => this.world.players.get(id))
      .filter((p): p is Player => !!p)
      .map((p) => ({ id: p.id, name: p.name, value: this.value.get(p.id) ?? 0 }));
    return {
      mentorId,
      mentorName: mentor?.name ?? null,
      students,
      partnerId,
      partnerName: partner?.name ?? null,
    };
  }

  sync(player: Player): void {
    this.world.connections.get(player.connId)?.send({ t: MsgType.SocialUpdate, social: this.info(player) });
  }
}
