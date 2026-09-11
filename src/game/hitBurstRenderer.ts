import { HIT_LOOKS, hitVisualProgress, type HitVisual } from "./hitFeedback.ts";

function ring(c: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2);
}

// Local, bounded geometry leaves the approaching notes readable. No scene
// shake, screen-wide flash, random allocation or independent animation clock.
export function drawHitBursts(
  c: CanvasRenderingContext2D, x: number, y: number, radius: number,
  hits: readonly HitVisual[], time: number, reducedMotion: boolean, strength: number,
): void {
  const visible = reducedMotion ? hits.slice(-1) : hits;
  for (let index = 0; index < visible.length; index++) {
    const hit = visible[index], { fade, spread } = hitVisualProgress(hit, time, reducedMotion);
    if (fade <= 0) continue;
    const latest = index === visible.length - 1;
    c.save();
    c.strokeStyle = HIT_LOOKS[hit.kind].color;
    c.fillStyle = HIT_LOOKS[hit.kind].color;
    c.globalAlpha = fade * (latest ? 1 : .4) * Math.max(.35, Math.min(1, strength));
    c.lineWidth = latest ? 3 : 2;

    if (hit.kind === "perfect") {
      ring(c, x, y, radius * (1.02 + spread * .65)); c.stroke();
      ring(c, x, y, radius * (1.2 + spread * .8)); c.stroke();
      if (!reducedMotion) for (let ray = 0; ray < 12; ray++) {
        const angle = Math.PI * 2 * ray / 12;
        const inner = radius * (1.1 + spread * .4), outer = radius * (1.38 + spread * .8);
        c.beginPath(); c.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
        c.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer); c.stroke();
      }
    } else if (hit.kind === "great") {
      ring(c, x, y, radius * (1.02 + spread * .45)); c.stroke();
    } else if (hit.kind === "good") {
      c.setLineDash([5, 7]); ring(c, x, y, radius * (1 + spread * .22)); c.stroke(); c.setLineDash([]);
    } else if (hit.kind === "empty") {
      c.lineWidth = 1.5; ring(c, x, y, radius * (.65 + spread * .3)); c.stroke();
    }

    if (latest) {
      const size = radius * .49;
      const cy = y + (hit.kind === "miss" ? spread * 7 : 0);
      c.globalAlpha *= .92;
      c.lineWidth = 4;
      c.lineCap = "round"; c.lineJoin = "round";
      if (hit.kind === "perfect") {
        c.beginPath();
        for (let point = 0; point < 10; point++) {
          const angle = -Math.PI / 2 + Math.PI * point / 5;
          const r = size * (point % 2 ? .45 : 1.2);
          if (point === 0) c.moveTo(x + Math.cos(angle) * r, cy + Math.sin(angle) * r);
          else c.lineTo(x + Math.cos(angle) * r, cy + Math.sin(angle) * r);
        }
        c.closePath(); c.fill();
      } else if (hit.kind === "great") {
        ring(c, x, cy, size); c.stroke();
      } else if (hit.kind === "good") {
        c.beginPath(); c.moveTo(x, cy - size); c.lineTo(x + size, cy + size * .75);
        c.lineTo(x - size, cy + size * .75); c.closePath(); c.stroke();
      } else if (hit.kind === "miss") {
        c.beginPath(); c.moveTo(x - size * .75, cy - size * .75); c.lineTo(x + size * .75, cy + size * .75);
        c.moveTo(x + size * .75, cy - size * .75); c.lineTo(x - size * .75, cy + size * .75); c.stroke();
      }
    }
    c.restore();
  }
}
