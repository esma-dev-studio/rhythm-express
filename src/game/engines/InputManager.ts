import type { GameAction } from "../types.ts";

export type InputCallback = (action: GameAction, isDown: boolean, eventTimeMs: number) => void;

const INTERACTIVE_SELECTOR = "button, input, select, textarea, a, [role='button']";

export function shouldIgnoreGlobalInputTarget(target: EventTarget | null): boolean {
  const candidate = target as (EventTarget & { closest?: (selector: string) => Element | null }) | null;
  if (!candidate || typeof candidate.closest !== "function") return false;
  const gameControl = candidate.closest('[data-game-input="true"]');
  return Boolean(candidate.closest(INTERACTIVE_SELECTOR) && !gameControl);
}

export class InputManager {
  private active = false;
  private readonly pressedKeys = new Set<string>();

  constructor(private readonly callback: InputCallback) {}

  attach(): void {
    if (this.active) return;
    this.active = true;
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp, { passive: false });
  }

  detach(): void {
    this.active = false;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.pressedKeys.clear();
  }

  private mapKey(key: string): GameAction | null {
    if (key === " " || key === "Enter") return "tap";
    if (key === "ArrowLeft") return "left";
    if (key === "ArrowRight") return "right";
    return null;
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    const action = this.mapKey(event.key);
    if (!action || event.repeat || shouldIgnoreGlobalInputTarget(event.target)) return;
    event.preventDefault();
    this.pressedKeys.add(event.key);
    this.callback(action, true, event.timeStamp);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    const action = this.mapKey(event.key);
    if (!action || !this.pressedKeys.has(event.key)) return;
    event.preventDefault();
    this.pressedKeys.delete(event.key);
    this.callback(action, false, event.timeStamp);
  };
}