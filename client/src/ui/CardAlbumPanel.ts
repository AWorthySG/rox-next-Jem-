import {
  CARD_IDS,
  CARD_ALBUM_HP_PER,
  CARD_ALBUM_SP_PER,
  CARD_ALBUM_COMPLETE_HP,
  CARD_ALBUM_COMPLETE_SP,
  getItem,
  isCardComplete,
  type SelfState,
} from "@rox/shared";

// The Card Album panel: a grid of every card in the game, with the ones the
// player has collected lit up and the rest shown as locked silhouettes. A
// header tracks collection progress and the current collector's bonus. Reads
// from each SelfSync; no server round-trip (the album lives in SelfState).
export class CardAlbumPanel {
  private root = document.getElementById("card-album")!;
  private head = document.getElementById("card-album-head")!;
  private grid = document.getElementById("card-album-grid")!;
  private last: SelfState | null = null;

  constructor() {
    document.getElementById("card-album-close")!.addEventListener("click", () => this.close());
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen) this.close();
    });
  }

  get isOpen(): boolean {
    return !this.root.classList.contains("hidden");
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    this.root.classList.remove("hidden");
    if (this.last) this.render(this.last);
  }

  close(): void {
    this.root.classList.add("hidden");
  }

  sync(self: SelfState): void {
    this.last = self;
    if (this.isOpen) this.render(self);
  }

  private render(self: SelfState): void {
    const owned = new Set(self.album.registered);
    const count = owned.size;
    const total = self.album.total;
    const complete = isCardComplete(count);
    this.head.innerHTML =
      `<div class="album-count">${count} / ${total} cards collected${complete ? " · <span class=\"album-done\">Complete!</span>" : ""}</div>` +
      `<div class="album-bonus">Collector's bonus: +${count * CARD_ALBUM_HP_PER} Max HP · +${count * CARD_ALBUM_SP_PER} Max SP` +
      (complete ? ` · +${CARD_ALBUM_COMPLETE_HP}/${CARD_ALBUM_COMPLETE_SP} set bonus` : "") +
      `</div>`;

    this.grid.innerHTML = "";
    for (const id of CARD_IDS) {
      const has = owned.has(id);
      const cell = document.createElement("div");
      cell.className = "album-cell" + (has ? "" : " locked");
      const name = getItem(id)?.name ?? id;
      cell.title = name;
      cell.innerHTML = `<div class="album-icon">${has ? "🃏" : "❔"}</div><div class="album-name">${has ? name : "???"}</div>`;
      this.grid.appendChild(cell);
    }
  }
}
