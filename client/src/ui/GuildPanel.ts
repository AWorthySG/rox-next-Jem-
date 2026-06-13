import { JOB_NAME, type GuildInfo } from "@rox/shared";

export interface GuildHandlers {
  onCreate(name: string): void;
  onJoin(name: string): void;
  onLeave(): void;
}

// Guild window (key "G"): create or join a guild by name, or view the roster and
// leave. Driven by GuildUpdate messages.
export class GuildPanel {
  private root = document.getElementById("guild")!;
  private body = document.getElementById("guild-body")!;
  private guild: GuildInfo | null = null;
  private selfId = -1;

  constructor(private handlers: GuildHandlers) {
    document.getElementById("guild-close")!.addEventListener("click", () => this.close());
    window.addEventListener("keydown", (e) => {
      if (isTyping() && (e.key === "g" || e.key === "G")) return;
      if (e.key === "g" || e.key === "G") this.toggle();
      else if (e.key === "Escape" && this.isOpen) this.close();
    });
  }

  setSelf(id: number): void {
    this.selfId = id;
  }

  get isOpen(): boolean {
    return !this.root.classList.contains("hidden");
  }

  toggle(): void {
    this.root.classList.toggle("hidden");
    if (this.isOpen) this.render();
  }

  close(): void {
    this.root.classList.add("hidden");
  }

  setGuild(guild: GuildInfo | null): void {
    this.guild = guild;
    if (this.isOpen) this.render();
  }

  private render(): void {
    this.body.innerHTML = "";
    if (!this.guild) {
      this.body.innerHTML = `
        <p class="guild-hint">You are not in a guild.</p>
        <label class="field"><span>Create a guild</span>
          <div class="guild-row"><input id="guild-create-name" maxlength="20" placeholder="Guild name" />
          <button class="quest-btn" id="guild-create-btn">Create</button></div>
        </label>
        <label class="field"><span>Join a guild</span>
          <div class="guild-row"><input id="guild-join-name" maxlength="20" placeholder="Existing guild name" />
          <button class="quest-btn" id="guild-join-btn">Join</button></div>
        </label>`;
      const createName = this.body.querySelector("#guild-create-name") as HTMLInputElement;
      const joinName = this.body.querySelector("#guild-join-name") as HTMLInputElement;
      this.body.querySelector("#guild-create-btn")!.addEventListener("click", () => {
        if (createName.value.trim()) this.handlers.onCreate(createName.value.trim());
      });
      this.body.querySelector("#guild-join-btn")!.addEventListener("click", () => {
        if (joinName.value.trim()) this.handlers.onJoin(joinName.value.trim());
      });
      return;
    }

    const rows = this.guild.members
      .map((m) => {
        const lead = m.id === this.guild!.masterId ? "★ " : "";
        const you = m.id === this.selfId ? " (you)" : "";
        return `<div class="guild-member">${lead}${m.name}${you} <span class="pm-job">Lv${m.level} ${JOB_NAME[m.job]}</span></div>`;
      })
      .join("");
    this.body.innerHTML =
      `<div class="guild-title">⚑ ${this.guild.name} <span class="pm-job">(${this.guild.members.length})</span></div>` +
      `<div class="guild-members">${rows}</div>` +
      `<button class="party-leave" id="guild-leave-btn">Leave Guild</button>`;
    this.body.querySelector("#guild-leave-btn")!.addEventListener("click", () => this.handlers.onLeave());
  }
}

function isTyping(): boolean {
  const a = document.activeElement;
  return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA");
}
