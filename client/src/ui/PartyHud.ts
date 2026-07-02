import { JOB_NAME, type PartyInfo } from "@rox/shared";

interface MemberRow {
  id: number;
  fill: HTMLElement;
  bar: HTMLElement;
}

// Shows the current party roster with live HP bars. HP is read each frame from a
// supplier (the game state) since membership messages arrive only on changes.
export class PartyHud {
  private root = document.getElementById("party")!;
  private list = document.getElementById("party-members")!;
  private rows: MemberRow[] = [];
  private selfId = -1;

  constructor(
    onLeave: () => void,
    private hpOf: (id: number) => { hp: number; maxHp: number } | null,
  ) {
    document.getElementById("party-leave")!.addEventListener("click", onLeave);
  }

  setSelf(id: number): void {
    this.selfId = id;
  }

  setParty(party: PartyInfo | null): void {
    if (!party || party.members.length === 0) {
      this.root.classList.add("hidden");
      this.list.innerHTML = "";
      this.rows = [];
      return;
    }
    this.root.classList.remove("hidden");
    this.list.innerHTML = "";
    this.rows = [];
    for (const m of party.members) {
      const row = document.createElement("div");
      row.className = "party-member";
      const isLeader = m.id === party.leaderId;
      const isSelf = m.id === this.selfId;
      row.innerHTML =
        `<div class="pm-name">${isLeader ? "★ " : ""}${m.name}${isSelf ? " (you)" : ""} ` +
        `<span class="pm-job">Lv${m.level} ${JOB_NAME[m.job]}</span></div>` +
        `<div class="pm-bar"><i></i></div>`;
      const fill = row.querySelector(".pm-bar > i") as HTMLElement;
      const bar = row.querySelector(".pm-bar") as HTMLElement;
      this.list.appendChild(row);
      this.rows.push({ id: m.id, fill, bar });
    }
  }

  update(): void {
    for (const r of this.rows) {
      const hp = this.hpOf(r.id);
      const pct = hp && hp.maxHp ? Math.max(0, Math.min(1, hp.hp / hp.maxHp)) : 1;
      r.fill.style.width = `${pct * 100}%`;
      // a party member in danger should be obvious at a glance, same as your own HUD
      r.bar.classList.toggle("low", pct > 0 && pct <= 0.3);
    }
  }
}
