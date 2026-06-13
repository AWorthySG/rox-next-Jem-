import { MsgType, PARTY_MAX_SIZE, type PartyInfo } from "@rox/shared";
import type { World } from "./World.js";
import type { Player } from "./Player.js";

export interface Party {
  id: number;
  leaderId: number;
  members: number[]; // player entity ids
}

// Party lifecycle + EXP-share membership. Kept separate from World so the
// invite/accept/leave rules live in one place.
export class PartySystem {
  private parties = new Map<number, Party>();
  private pendingInvites = new Map<number, number>(); // targetPlayerId -> partyId
  private nextId = 1;

  constructor(private world: World) {}

  get(partyId: number): Party | undefined {
    return this.parties.get(partyId);
  }

  membersOf(partyId: number): Player[] {
    const party = this.parties.get(partyId);
    if (!party) return [];
    const out: Player[] = [];
    for (const id of party.members) {
      const p = this.world.players.get(id);
      if (p) out.push(p);
    }
    return out;
  }

  // Inviter creates a party on first invite. Returns the invite payload to send
  // to the target, or null if the invite is invalid.
  invite(from: Player, targetId: number): { partyId: number; fromName: string } | null {
    const target = this.world.players.get(targetId);
    if (!target || target.id === from.id || target.partyId != null) return null;

    let party = from.partyId != null ? this.parties.get(from.partyId) : undefined;
    if (!party) {
      party = { id: this.nextId++, leaderId: from.id, members: [from.id] };
      this.parties.set(party.id, party);
      from.partyId = party.id;
    }
    if (party.members.length >= PARTY_MAX_SIZE) return null;
    this.pendingInvites.set(target.id, party.id);
    return { partyId: party.id, fromName: from.name };
  }

  accept(player: Player, partyId: number): void {
    if (player.partyId != null) return;
    if (this.pendingInvites.get(player.id) !== partyId) return;
    this.pendingInvites.delete(player.id);
    const party = this.parties.get(partyId);
    if (!party || party.members.length >= PARTY_MAX_SIZE) return;
    party.members.push(player.id);
    player.partyId = partyId;
    this.broadcast(party);
  }

  leave(player: Player): void {
    const partyId = player.partyId;
    if (partyId == null) return;
    const party = this.parties.get(partyId);
    player.partyId = null;
    this.sendUpdate(player, null);
    if (!party) return;
    party.members = party.members.filter((id) => id !== player.id);

    if (party.members.length < 2) {
      // Disband: release the last member too.
      for (const id of party.members) {
        const m = this.world.players.get(id);
        if (m) {
          m.partyId = null;
          this.sendUpdate(m, null);
        }
      }
      this.parties.delete(party.id);
      return;
    }
    if (party.leaderId === player.id) party.leaderId = party.members[0];
    this.broadcast(party);
  }

  private info(party: Party): PartyInfo {
    return {
      id: party.id,
      leaderId: party.leaderId,
      members: this.membersOf(party.id).map((p) => ({ id: p.id, name: p.name, level: p.level, job: p.job })),
    };
  }

  private broadcast(party: Party): void {
    const payload = this.info(party);
    for (const p of this.membersOf(party.id)) this.sendInfo(p, payload);
  }

  private sendInfo(player: Player, info: PartyInfo): void {
    this.world.connections.get(player.connId)?.send({ t: MsgType.PartyUpdate, party: info });
  }

  private sendUpdate(player: Player, info: PartyInfo | null): void {
    this.world.connections.get(player.connId)?.send({ t: MsgType.PartyUpdate, party: info });
  }
}
