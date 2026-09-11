import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const CHILD_COPY_FILES = [
  "src/GameApp.tsx",
  "src/components/GameCanvas.tsx",
  "src/components/ExpeditionCanvas.tsx",
  "src/game/rhythmCue.ts",
  "src/game/musicScore.ts",
  "src/game/hitFeedback.ts",
  "src/game/handPlay.ts",
  "src/game/rhythmRival.ts",
  "src/components/GameScreen.tsx",
  "src/components/MenuScreens.tsx",
  "src/game/adventureEvents.ts",
  "src/game/data/stages.ts",
  "src/game/data/trains.ts",
  "src/game/engines/GameSession.ts",
  "src/game/engines/JudgementEngine.ts",
  "src/game/journeyRewards.ts",
  "src/game/repository/ProgressRepository.ts",
  "src/game/runGoals.ts",
] as const;

test("child-facing copy does not rely on kanji", async () => {
  for (const relativePath of CHILD_COPY_FILES) {
    let source = await readFile(new URL("../" + relativePath, import.meta.url), "utf8");
    if (relativePath.endsWith("MenuScreens.tsx")) {
      const parentStart = source.indexOf("export function ParentsScreen");
      const parentEnd = source.indexOf("interface ResultScreenProps");
      assert.ok(parentStart >= 0 && parentEnd > parentStart);
      source = source.slice(0, parentStart) + source.slice(parentEnd);
    }
    const kanji = source.match(/[\p{Script=Han}々]/gu) ?? [];
    assert.deepEqual(
      [...new Set(kanji)],
      [],
      relativePath + " still contains child-facing kanji: " + [...new Set(kanji)].join(""),
    );
  }
});
