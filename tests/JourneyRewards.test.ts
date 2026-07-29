import assert from "node:assert/strict";
import test from "node:test";
import {
  SOUVENIR_STICKERS,
  journeyTicketFilled,
  journeysUntilNextSticker,
  normalizeOwnedStickers,
  rewardForJourney,
} from "../src/game/journeyRewards.ts";

test("the ticket always gives a small three-run goal", () => {
  assert.equal(journeyTicketFilled(0), 0);
  assert.equal(journeysUntilNextSticker(0), 3);
  assert.equal(journeyTicketFilled(1), 1);
  assert.equal(journeysUntilNextSticker(1), 2);
  assert.equal(journeyTicketFilled(2), 2);
  assert.equal(journeysUntilNextSticker(2), 1);
  assert.equal(journeyTicketFilled(3), 0);
});

test("the third journey reveals one predictable new sticker", () => {
  assert.equal(rewardForJourney(1, []).completedCard, false);
  assert.equal(rewardForJourney(2, []).stickerId, undefined);
  const reward = rewardForJourney(3, []);
  assert.equal(reward.completedCard, true);
  assert.equal(reward.stampPosition, 3);
  assert.equal(reward.stickerId, SOUVENIR_STICKERS[0].id);
});

test("owned sticker progress is unique, valid, and never repeats a reward", () => {
  const owned = normalizeOwnedStickers([
    SOUVENIR_STICKERS[0].id,
    "not-a-sticker",
    SOUVENIR_STICKERS[0].id,
  ]);
  assert.deepEqual(owned, [SOUVENIR_STICKERS[0].id]);
  assert.equal(rewardForJourney(6, owned).stickerId, SOUVENIR_STICKERS[1].id);
  assert.equal(
    rewardForJourney(30, SOUVENIR_STICKERS.map((sticker) => sticker.id)).stickerId,
    undefined,
  );
});
