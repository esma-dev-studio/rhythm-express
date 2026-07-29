import assert from "node:assert/strict";
import test from "node:test";
import { shouldIgnoreGlobalInputTarget } from "../src/game/engines/InputManager.ts";

test("global rhythm shortcuts ignore ordinary interactive controls", () => {
  const interactive = {
    closest(selector: string) {
      return selector.startsWith("button") ? {} : null;
    },
  } as unknown as EventTarget;
  assert.equal(shouldIgnoreGlobalInputTarget(interactive), true);
});

test("an explicit game input control may receive rhythm shortcuts", () => {
  const gameControl = {
    closest() {
      return {};
    },
  } as unknown as EventTarget;
  assert.equal(shouldIgnoreGlobalInputTarget(gameControl), false);
  assert.equal(shouldIgnoreGlobalInputTarget(null), false);
});
