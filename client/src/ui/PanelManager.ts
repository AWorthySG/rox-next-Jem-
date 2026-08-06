export interface ManagedPanel {
  isOpen: boolean;
  close(): void;
}

// Coordinates the game's centered modal panels (bag, storage, skills, guild,
// runes, quests, shop, etc). They all render dead-center with the same
// z-index, so without this, opening a second one while another is up just
// stacks them exactly on top of each other with no way to tell which is
// "on top" or to get back to the one underneath. Every managed panel
// registers itself on construction and calls closeOthers() whenever it
// opens, so at most one is ever visible at a time.
class PanelManager {
  private panels: ManagedPanel[] = [];

  register(panel: ManagedPanel): void {
    this.panels.push(panel);
  }

  closeOthers(opening: ManagedPanel): void {
    for (const panel of this.panels) {
      if (panel !== opening && panel.isOpen) panel.close();
    }
  }
}

export const panelManager = new PanelManager();
