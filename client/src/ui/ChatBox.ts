// Chat log + input. Enter focuses the input; Enter again sends and unfocuses so
// keyboard input doesn't interfere with clicking to move.
export class ChatBox {
  private log: HTMLElement;
  private input: HTMLInputElement;

  constructor(private onSend: (text: string) => void) {
    this.log = document.getElementById("chat-log")!;
    this.input = document.getElementById("chat-input") as HTMLInputElement;

    window.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        if (document.activeElement === this.input) {
          const text = this.input.value.trim();
          if (text) this.onSend(text);
          this.input.value = "";
          this.input.classList.add("hidden");
          this.input.blur();
        } else if (!isTyping()) {
          this.input.classList.remove("hidden");
          this.input.focus();
        }
      } else if (e.key === "Escape" && document.activeElement === this.input) {
        this.input.value = "";
        this.input.classList.add("hidden");
        this.input.blur();
      }
    });
  }

  add(who: string, text: string, self: boolean): void {
    const line = document.createElement("div");
    line.className = "chat-line";
    line.innerHTML = `<span class="who">${escape(who)}${self ? " (you)" : ""}:</span> ${escape(text)}`;
    this.append(line);
  }

  system(text: string): void {
    const line = document.createElement("div");
    line.className = "chat-line system";
    line.textContent = text;
    this.append(line);
  }

  private append(line: HTMLElement): void {
    this.log.appendChild(line);
    while (this.log.childElementCount > 50) this.log.removeChild(this.log.firstChild!);
    this.log.scrollTop = this.log.scrollHeight;
  }
}

function isTyping(): boolean {
  const a = document.activeElement;
  return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA");
}

function escape(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}
