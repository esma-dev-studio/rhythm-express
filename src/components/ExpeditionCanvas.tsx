"use client";

import { useEffect, useRef } from "react";
import type { EffectsSnapshot } from "../game/engines/EffectsManager";
import type { GameSession } from "../game/engines/GameSession";
import type { RuntimeNote, StageDefinition, StageTheme } from "../game/types";
import { STAGES } from "../game/data/stages";
import { observeMediaQuery, traceRoundedRect as rect } from "../game/browserCompatibility";
import { noteScreenX, rhythmGeometry, routeArtwork } from "../game/presentation";
import { getRhythmCue } from "../game/rhythmCue";

interface GameCanvasProps {
  stage: StageDefinition; session: GameSession; getPlayhead: () => number; travelTime: number;
  effects: EffectsSnapshot; reducedMotion: boolean; effectsStrength: number; routeLane: number; trainColor: string;
}
interface SceneState {
  stage: StageDefinition; playhead: number; notes: RuntimeNote[]; travelTime: number; energy: number;
  pulse: number; shake: number; driveActive: boolean; reducedMotion: boolean; effectsStrength: number;
  routeLane: number; trainColor: string; titleMode: boolean;
}
const artwork = new Map<StageTheme, HTMLImageElement>();
function getArtwork(theme: StageTheme): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  let img = artwork.get(theme);
  if (!img) { img = new Image(); img.decoding = "async"; img.src = routeArtwork(theme); artwork.set(theme, img); }
  return img.complete && img.naturalWidth > 0 ? img : null;
}
function circle(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.beginPath(); c.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
}
function box(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 0) {
  rect(c, x, y, Math.max(0, w), Math.max(0, h), r); c.fill();
}
function drawLandscape(c: CanvasRenderingContext2D, w: number, h: number, s: SceneState, travel: number) {
  const img = getArtwork(s.stage.theme), imageHeight = s.titleMode ? h : h * .73;
  const sky = c.createLinearGradient(0, 0, 0, imageHeight);
  sky.addColorStop(0, s.stage.theme === "moon" ? "#07122b" : "#235b70"); sky.addColorStop(1, "#142e39");
  c.fillStyle = sky; c.fillRect(0, 0, w, h);
  if (img) {
    const extra = w * .15;
    const drift = s.reducedMotion ? extra / 2 : (Math.sin(travel / 2600) + 1) * extra / 2;
    c.drawImage(img, -drift, 0, w + extra, imageHeight);
  }
  const shade = c.createLinearGradient(0, imageHeight * .35, 0, imageHeight);
  shade.addColorStop(0, "#05182300"); shade.addColorStop(1, "#051823c9");
  c.fillStyle = shade; c.fillRect(0, 0, w, imageHeight);
  if (s.driveActive) { c.fillStyle = "#6adbc418"; c.fillRect(0, 0, w, imageHeight); }
}
function drawRailway(c: CanvasRenderingContext2D, w: number, y: number, travel: number, drive: boolean) {
  c.fillStyle = "#07151e"; c.fillRect(0, y + 8, w, 22); c.fillStyle = "#53646a";
  for (let x = -(travel % 56); x < w + 56; x += 56) c.fillRect(x, y + 4, 17, 18);
  const metal = c.createLinearGradient(0, y, 0, y + 10);
  metal.addColorStop(0, drive ? "#adfff0" : "#a9bac0"); metal.addColorStop(.4, "#3e626e"); metal.addColorStop(1, "#112630");
  c.fillStyle = metal; c.fillRect(0, y, w, 7); c.fillRect(0, y + 20, w, 4);
  c.fillStyle = "#071720";
  for (let x = -((travel * .6) % 190); x < w + 190; x += 190) {
    c.fillRect(x, y + 27, 8, 35); c.beginPath(); c.moveTo(x + 8, y + 30); c.lineTo(x + 76, y + 58); c.lineTo(x + 86, y + 58); c.lineTo(x + 8, y + 23); c.fill();
  }
}
function drawExpress(c: CanvasRenderingContext2D, x: number, y: number, scale: number, s: SceneState, travel: number) {
  c.save(); c.translate(x, y); c.scale(scale, scale);
  c.translate(0, s.reducedMotion ? 0 : Math.sin(travel * .04) * .7 - s.pulse * 2);
  if (s.driveActive || s.pulse > .15) {
    const trail = c.createLinearGradient(-150, 0, 210, 0);
    trail.addColorStop(0, "#73eed500"); trail.addColorStop(1, "#73eed56b"); c.fillStyle = trail; box(c, -140, -22, 455, 14, 7);
  }
  for (let car = 0; car < 3; car++) {
    const cx = car * 109, nose = car === 2;
    c.fillStyle = "#071016"; box(c, cx + 4, -15, 99, 20, 7);
    for (const wx of [cx + 22, cx + 82]) {
      c.fillStyle = "#09131c"; circle(c, wx, -1, 10); c.fill();
      c.strokeStyle = "#7c929a"; c.lineWidth = 2; circle(c, wx, -1, 7); c.stroke();
      c.save(); c.translate(wx, -1); c.rotate(travel * .08); c.beginPath(); c.moveTo(-6, 0); c.lineTo(6, 0); c.moveTo(0, -6); c.lineTo(0, 6); c.stroke(); c.restore();
    }
    const shell = c.createLinearGradient(0, -70, 0, -10);
    shell.addColorStop(0, "#eff7f5"); shell.addColorStop(.14, "#adc6cd"); shell.addColorStop(.4, "#f0f3e8"); shell.addColorStop(.77, "#819ba6"); shell.addColorStop(1, "#314e61");
    c.fillStyle = shell; c.beginPath(); c.moveTo(cx + 4, -12); c.lineTo(cx + 4, -54); c.quadraticCurveTo(cx + 4, -68, cx + 20, -68); c.lineTo(cx + (nose ? 62 : 90), -68);
    if (nose) { c.bezierCurveTo(cx + 85, -66, cx + 122, -29, cx + 132, -23); c.quadraticCurveTo(cx + 138, -12, cx + 112, -12); }
    else { c.quadraticCurveTo(cx + 103, -68, cx + 103, -54); c.lineTo(cx + 103, -12); }
    c.closePath(); c.fill(); c.strokeStyle = "#d9eeee70"; c.lineWidth = 1; c.stroke();
    c.fillStyle = "#15394d"; box(c, cx + 12, -54, nose ? 65 : 84, 21, 4);
    const glass = c.createLinearGradient(0, -54, 0, -33); glass.addColorStop(0, "#69b8cba0"); glass.addColorStop(1, "#122d3f");
    c.fillStyle = glass; box(c, cx + 14, -52, nose ? 59 : 80, 17, 3); c.fillStyle = "#a8c4c4";
    for (let win = 1; win < (nose ? 3 : 4); win++) c.fillRect(cx + 12 + win * 21, -54, 2, 21);
    if (nose) { c.fillStyle = "#15394d"; c.beginPath(); c.moveTo(cx + 80, -53); c.lineTo(cx + 105, -30); c.lineTo(cx + 83, -30); c.closePath(); c.fill(); }
    c.fillStyle = s.trainColor; box(c, cx + 7, -28, nose ? 105 : 96, 5, 1);
    c.fillStyle = s.driveActive ? "#a3fff0" : "#d9b96d"; box(c, cx + 10, -18, nose ? 99 : 90, 2, 1);
    c.strokeStyle = "#496777"; c.lineWidth = 1; c.strokeRect(cx + 6, -60, 6, 41);
    if (!nose) { c.fillStyle = "#152e3d"; c.fillRect(cx + 103, -51, 6, 34); }
  }
  const light = c.createLinearGradient(345, 0, 535, 0); light.addColorStop(0, "#fcf0bd55"); light.addColorStop(1, "#fcf0bd00");
  c.fillStyle = light; c.beginPath(); c.moveTo(345, -24); c.lineTo(535, -55); c.lineTo(535, 5); c.closePath(); c.fill();
  c.fillStyle = "#fff3ca"; box(c, 339, -26, 9, 4, 2);
  if (!s.reducedMotion && s.pulse > .3 && s.shake < .1) {
    c.strokeStyle = "#afffe4"; c.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      const px = (i * 37 + (1 - s.pulse) * 80) % 340, py = -74 - (1 - s.pulse) * (12 + i * 2);
      c.globalAlpha = s.pulse * .7; c.beginPath(); c.moveTo(px, py); c.lineTo(px - 9, py + 3); c.stroke();
    }
  }
  c.restore();
}
function drawNote(c: CanvasRenderingContext2D, n: RuntimeNote, x: number, y: number, pps: number, radius: number, tx: number) {
  if (n.state === "resolved") return;
  const size = radius * .66; c.save(); c.translate(x, y); c.lineWidth = 2.5; c.strokeStyle = "#fff1c9";
  if (n.type === "beam") {
    const end = n.duration * pps, start = n.state === "holding" ? Math.max(0, tx - x) : 0;
    c.fillStyle = n.state === "holding" ? "#a7ffe1" : "#45bca7"; box(c, start, -size * .6, end - start, size * 1.2, size * .5);
    c.fillStyle = "#eafff7"; circle(c, end, 0, size * .66); c.fill(); c.fillStyle = "#1b6866"; circle(c, end, 0, size * .32); c.fill();
    c.fillStyle = "#86f1d7"; circle(c, start, 0, size); c.fill(); c.strokeStyle = "#e7fff6"; c.stroke(); c.fillStyle = "#103c3c"; box(c, start - 7, -3, 14, 6, 3);
  } else if (n.type === "quiet") {
    const length = Math.max(52, n.duration * pps); c.fillStyle = "#8297a233"; box(c, -size, -size - 3, length + size * 2, size * 2 + 6, 8);
    c.save(); rect(c, -size, -size - 3, length + size * 2, size * 2 + 6, 8); c.clip(); c.strokeStyle = "#b8c9d54a"; c.lineWidth = 9;
    for (let px = -50; px < length + 50; px += 25) { c.beginPath(); c.moveTo(px, -40); c.lineTo(px + 42, 40); c.stroke(); }
    c.restore(); c.fillStyle = "#eef5f8"; c.font = "bold 15px sans-serif"; c.textAlign = "center"; c.fillText("おやすみ", length / 2, 5);
  } else if (n.type === "booster") {
    const count = Math.max(1, n.targetHits ?? 4), length = n.duration * pps;
    c.strokeStyle = "#ffd27b55"; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(length * (count - 1) / count, 0); c.stroke();
    for (let i = 0; i < count; i++) {
      const hit = n.boosterHitSlots.includes(i); c.fillStyle = hit ? "#365453" : "#ffd27b"; circle(c, length * i / count, 0, size * .76); c.fill(); c.fillStyle = hit ? "#86f1d7" : "#5d441b"; circle(c, length * i / count, 0, 4); c.fill();
    }
  } else if (n.type === "switch") {
    c.fillStyle = "#bba3ff"; box(c, -size, -size, size * 2, size * 2, 8); c.fillStyle = "#231742"; c.font = `bold ${size * 1.5}px sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(n.direction === "left" ? "←" : "→", 0, 0);
  } else {
    c.shadowColor = "#ffd27b"; c.shadowBlur = 10; c.fillStyle = "#ffd27b"; circle(c, 0, 0, size); c.fill(); c.shadowBlur = 0; c.stroke();
    c.fillStyle = "#65491d"; circle(c, 0, 0, size * .28); c.fill(); c.fillStyle = "#fff6d8"; circle(c, -size * .25, -size * .28, size * .14); c.fill();
  }
  c.restore();
}
function drawLane(c: CanvasRenderingContext2D, w: number, h: number, s: SceneState) {
  const { targetX: tx, targetY: ty, radius: r, laneTop, laneBottom } = rhythmGeometry(w, h);
  c.fillStyle = "#071923"; c.fillRect(0, laneTop, w, h - laneTop); c.fillStyle = "#122f3b"; box(c, 12, ty - r - 8, w - 24, r * 2 + 16, 12);
  c.strokeStyle = "#4d738144"; c.lineWidth = 1; c.beginPath(); c.moveTo(16, ty); c.lineTo(w - 16, ty); c.stroke();
  const pps = (w - tx - 34) / Math.max(.5, s.travelTime), beat = 60 / s.stage.bpm; c.fillStyle = "#698a9560";
  for (let t = Math.floor(s.playhead / beat) * beat; t < s.playhead + s.travelTime + beat; t += beat) c.fillRect(noteScreenX(t, s.playhead, w, tx, s.travelTime), ty + r + 16, 2, 5);
  const cue = getRhythmCue(s.notes, s.playhead);
  const rest = cue.mode === "rest" && s.notes.some(n => n.type === "quiet" && n.time <= s.playhead && n.time + n.duration > s.playhead);
  const due = cue.time !== null && Math.abs(cue.time - s.playhead) < .075;
  const ring = rest ? "#9bacbb" : cue.mode === "release" ? "#86f1d7" : "#ffd27b";
  c.fillStyle = rest ? "#8eacbb14" : "#ffe4a514"; c.fillRect(tx - r - 7, laneTop + 4, (r + 7) * 2, laneBottom - laneTop - 4);
  c.strokeStyle = ring; c.lineWidth = 2; c.beginPath(); c.moveTo(tx, laneTop + 8); c.lineTo(tx, ty - r - 7); c.moveTo(tx, ty + r + 7); c.lineTo(tx, laneBottom - 7); c.stroke();
  c.save(); rect(c, 12, ty - r - 9, w - 24, r * 2 + 18, 12); c.clip();
  for (const n of [...s.notes].reverse()) {
    const x = noteScreenX(n.time, s.playhead, w, tx, s.travelTime);
    if (x <= w + r && x + n.duration * pps >= -r) drawNote(c, n, x, ty, pps, r, tx);
  }
  c.restore(); c.shadowColor = ring; c.shadowBlur = s.reducedMotion ? 0 : (due ? 20 : s.pulse * 14);
  c.strokeStyle = "#06141e"; c.lineWidth = 9; circle(c, tx, ty, r); c.stroke(); c.strokeStyle = ring; c.lineWidth = due ? 5 : 3; circle(c, tx, ty, r); c.stroke(); c.shadowBlur = 0;
  if (s.pulse > .1 && s.shake < .1) {
    c.globalAlpha = s.pulse * .5; c.strokeStyle = "#b9ffe1"; c.lineWidth = 2; circle(c, tx, ty, r + (s.reducedMotion ? 3 : (1 - s.pulse) * 21)); c.stroke(); c.globalAlpha = 1;
  }
  c.textBaseline = "middle"; c.textAlign = "left"; c.font = "bold 14px sans-serif"; c.fillStyle = "#c5d9df"; c.fillText(cue.label, 20, laneTop - 13);
  c.textAlign = "right"; c.font = "13px sans-serif"; c.fillStyle = "#8aa6b1"; if (w > 550) c.fillText("ひかりは こっちから  ←", w - 24, laneTop - 13);
  c.textAlign = "center"; c.font = "bold 13px sans-serif"; c.fillStyle = ring; c.fillText(rest ? "まとう" : "ここ！", tx, h - 7);
}
function drawScene(c: CanvasRenderingContext2D, w: number, h: number, s: SceneState, travel: number) {
  drawLandscape(c, w, h, s, travel);
  const railwayY = h * (s.titleMode ? .63 : .53);
  drawRailway(c, w, railwayY, travel, s.driveActive);
  const scale = s.titleMode ? Math.min(1.6, w / 720) : Math.max(.48, Math.min(1.4, w / 850));
  const trainX = s.titleMode ? w * .5 : w * .12 + s.energy / 100 * w * .05;
  drawExpress(c, trainX, railwayY - 9 + (s.reducedMotion ? 0 : s.routeLane * 5), scale, s, travel);
  if (!s.titleMode) drawLane(c, w, h, s);
}
function useCanvasLoop(getState: () => SceneState) {
  const canvasRef = useRef<HTMLCanvasElement>(null), getStateRef = useRef(getState);
  useEffect(() => { getStateRef.current = getState; }, [getState]);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const c = canvas.getContext("2d"); if (!c) return;
    let frame = 0, width = 1, height = 1, ratio = 1, travel = 0;
    let previousPlayhead: number | null = null;
    const resize = () => {
      const bounds = canvas.getBoundingClientRect(); width = bounds.width; height = bounds.height; ratio = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.max(1, Math.round(width * ratio)); canvas.height = Math.max(1, Math.round(height * ratio));
    };
    resize(); const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(canvas); window.addEventListener("resize", resize);
    const render = () => {
      const s = getStateRef.current();
      const delta = previousPlayhead === null ? 0 : Math.max(0, Math.min(.08, s.playhead - previousPlayhead)); previousPlayhead = s.playhead;
      // Integrating speed avoids scenery jumps when a note changes energy.
      travel += delta * (s.reducedMotion ? 20 : 125 + s.energy * 1.6) * (s.driveActive ? 1.6 : 1);
      c.setTransform(ratio, 0, 0, ratio, 0, 0); c.clearRect(0, 0, width, height);
      if (width > 0 && height > 0) drawScene(c, width, height, s, travel);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener("resize", resize); };
  }, []);
  return canvasRef;
}
export function GameCanvas(props: GameCanvasProps) {
  const canvasRef = useCanvasLoop(() => {
    const playhead = props.getPlayhead();
    return { stage: props.stage, playhead, travelTime: props.travelTime, notes: props.session.chart.visible(playhead, props.travelTime),
      energy: props.effects.energy, pulse: props.effects.pulse * props.effectsStrength, shake: props.effects.shake,
      driveActive: props.effects.overdrive, reducedMotion: props.reducedMotion, effectsStrength: props.effectsStrength,
      routeLane: props.routeLane, trainColor: props.trainColor, titleMode: false };
  });
  return <canvas ref={canvasRef} className="game-canvas" aria-label={props.stage.name + "。みぎから くる ひかりが ○に かさなったら おそう"} />;
}
export function AttractCanvas() {
  const started = useRef(0), reduced = useRef(false);
  useEffect(() => observeMediaQuery("(prefers-reduced-motion: reduce)", value => { reduced.current = value; }), []);
  const canvasRef = useCanvasLoop(() => {
    const now = performance.now() / 1000; if (!started.current) started.current = now;
    return { stage: STAGES[0], playhead: now - started.current, notes: [], travelTime: 4, energy: 70, pulse: 0, shake: 0,
      driveActive: false, reducedMotion: reduced.current, effectsStrength: 1, routeLane: 0, trainColor: "#d5a65f", titleMode: true };
  });
  return <canvas ref={canvasRef} className="attract-canvas" aria-label="あさの うみべを はしる リズムれっしゃ" />;
}
