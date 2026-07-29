"use client";

import { useEffect, useRef } from "react";
import type { EffectsSnapshot } from "../game/engines/EffectsManager";
import type { GameSession } from "../game/engines/GameSession";
import type { RuntimeNote, StageDefinition } from "../game/types";
import { STAGES } from "../game/data/stages";
import { rhythmPulseAt } from "../game/rhythmGuide";
import { observeMediaQuery, traceRoundedRect as roundedRect } from "../game/browserCompatibility";

interface GameCanvasProps {
  stage: StageDefinition;
  session: GameSession;
  getPlayhead: () => number;
  travelTime: number;
  effects: EffectsSnapshot;
  reducedMotion: boolean;
  effectsStrength: number;
  routeLane: number;
  trainColor: string;
}

interface SceneState {
  stage: StageDefinition;
  playhead: number;
  travelTime: number;
  notes: RuntimeNote[];
  energy: number;
  pulse: number;
  shake: number;
  driveActive: boolean;
  driveProgress: number;
  reducedMotion: boolean;
  effectsStrength: number;
  routeLane: number;
  titleMode: boolean;
  trainColor: string;
}

function drawCity(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  travel: number,
): void {
  const sky = context.createLinearGradient(0, 0, 0, height * 0.58);
  sky.addColorStop(0, "#66bee8");
  sky.addColorStop(1, "#c7eef4");
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  context.fillStyle = "#f6d45b55";
  context.beginPath();
  context.arc(width * 0.8, height * 0.2, Math.min(width, height) * 0.095, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#f6d45b";
  context.beginPath();
  context.arc(width * 0.8, height * 0.2, Math.min(width, height) * 0.062, 0, Math.PI * 2);
  context.fill();

  const cloudOffset = -((travel * 4) % 270);
  for (let index = -1; index < width / 220 + 2; index += 1) {
    const x = cloudOffset + index * 270;
    const y = 42 + (index % 3) * 38;
    context.fillStyle = "#f6fbf8cc";
    context.beginPath();
    context.arc(x, y + 14, 24, 0, Math.PI * 2);
    context.arc(x + 27, y, 31, 0, Math.PI * 2);
    context.arc(x + 62, y + 15, 23, 0, Math.PI * 2);
    context.fill();
  }

  const farOffset = -((travel * 18) % 170);
  for (let index = -1; index < width / 125 + 2; index += 1) {
    const x = farOffset + index * 170;
    const buildingHeight = 82 + ((index + 9) % 4) * 28;
    context.fillStyle = index % 2 === 0 ? "#d7eaeb" : "#c6dfe2";
    context.fillRect(x, height * 0.42 - buildingHeight, 112, buildingHeight);
    context.fillStyle = index % 3 === 0 ? "#f16f61" : "#5b9297";
    context.fillRect(x + 8, height * 0.42 - buildingHeight - 7, 96, 7);
    context.fillStyle = "#5b9297";
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        context.fillRect(x + 16 + column * 29, height * 0.42 - buildingHeight + 16 + row * 22, 12, 9);
      }
    }
  }

  context.fillStyle = "#82bd8e";
  context.fillRect(0, height * 0.42, width, height * 0.29);
  context.fillStyle = "#9ed9d1";
  context.fillRect(0, height * 0.63, width, height * 0.06);

  const nearOffset = -((travel * 52) % 122);
  for (let index = -1; index < width / 95 + 2; index += 1) {
    const x = nearOffset + index * 122;
    context.fillStyle = "#255f55";
    context.fillRect(x + 42, height * 0.49, 10, height * 0.15);
    context.fillStyle = index % 2 === 0 ? "#348262" : "#45946b";
    context.beginPath();
    context.arc(x + 47, height * 0.46, 31, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#f6fbf8";
    context.fillRect(x + 78, height * 0.55, 4, 28);
    context.fillStyle = "#f16f61";
    context.fillRect(x + 70, height * 0.54, 20, 7);
  }
}
function drawJungle(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  travel: number,
): void {
  const sky = context.createLinearGradient(0, 0, 0, height * 0.65);
  sky.addColorStop(0, "#61b9af");
  sky.addColorStop(1, "#d6e68e");
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  context.fillStyle = "#75a963";
  context.beginPath();
  context.moveTo(0, height * 0.42);
  for (let x = 0; x <= width; x += 90) {
    context.lineTo(x, height * 0.34 + Math.sin(x * 0.013 + travel * 0.006) * 34);
  }
  context.lineTo(width, height * 0.66);
  context.lineTo(0, height * 0.66);
  context.closePath();
  context.fill();

  const farOffset = -((travel * 24) % 162);
  for (let index = -1; index < width / 125 + 2; index += 1) {
    const x = farOffset + index * 162;
    context.fillStyle = "#1d5d46";
    context.fillRect(x + 62, height * 0.17, 22, height * 0.5);
    context.fillStyle = index % 2 === 0 ? "#2b7652" : "#39855a";
    context.beginPath();
    context.arc(x + 72, height * 0.15, 68, 0, Math.PI * 2);
    context.arc(x + 30, height * 0.19, 48, 0, Math.PI * 2);
    context.arc(x + 114, height * 0.18, 50, 0, Math.PI * 2);
    context.fill();
  }

  const waterfallX = width * 0.78 - ((travel * 30) % (width * 1.45));
  context.fillStyle = "#eafaf5";
  context.fillRect(waterfallX - 4, height * 0.2, 64, height * 0.44);
  context.fillStyle = "#8ed9d5";
  context.fillRect(waterfallX + 10, height * 0.2, 34, height * 0.44);
  context.fillStyle = "#f6fbf8";
  for (let index = 0; index < 5; index += 1) {
    context.beginPath();
    context.arc(waterfallX + index * 14, height * 0.64, 12, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = "#205e47";
  context.fillRect(0, height * 0.59, width, height * 0.15);

  const vineOffset = -((travel * 68) % 142);
  context.strokeStyle = "#153f34";
  context.lineWidth = 7;
  for (let index = -1; index < width / 120 + 2; index += 1) {
    const x = vineOffset + index * 142;
    context.beginPath();
    context.moveTo(x, 0);
    context.quadraticCurveTo(x + 58, height * 0.2, x + 24, height * 0.43);
    context.stroke();
    context.fillStyle = index % 2 ? "#f4cf56" : "#f16f61";
    context.beginPath();
    context.arc(x + 26, height * 0.44, 5, 0, Math.PI * 2);
    context.fill();
  }

  context.strokeStyle = "#17344a";
  context.lineWidth = 3;
  for (let index = 0; index < 3; index += 1) {
    const x = width * (0.28 + index * 0.2) - ((travel * 8) % 90);
    const y = height * (0.16 + (index % 2) * 0.08);
    context.beginPath();
    context.arc(x, y, 9, Math.PI * 1.08, Math.PI * 1.75);
    context.arc(x + 17, y, 9, Math.PI * 1.25, Math.PI * 1.92);
    context.stroke();
  }
}
function drawMoon(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  travel: number,
): void {
  const sky = context.createLinearGradient(0, 0, 0, height * 0.68);
  sky.addColorStop(0, "#081235");
  sky.addColorStop(1, "#20275d");
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  const earthX = width * 0.78 - ((travel * 3) % (width * 1.3));
  context.fillStyle = "#68c4dd33";
  context.beginPath();
  context.arc(earthX, height * 0.18, 62, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#72cde3";
  context.beginPath();
  context.arc(earthX, height * 0.18, 46, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#73b674";
  context.beginPath();
  context.ellipse(earthX - 10, height * 0.16, 18, 9, -0.45, 0, Math.PI * 2);
  context.ellipse(earthX + 16, height * 0.2, 13, 18, 0.5, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#f3cf58";
  for (let index = 0; index < 70; index += 1) {
    const rawX = index * 97 + 31 - travel * (3 + (index % 3));
    const x = ((rawX % (width + 30)) + width + 30) % (width + 30);
    const y = 22 + ((index * 53) % Math.max(1, Math.floor(height * 0.5)));
    const radius = index % 9 === 0 ? 2.5 : index % 4 === 0 ? 1.6 : 1;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = "#493c83";
  context.beginPath();
  context.moveTo(0, height * 0.5);
  for (let x = 0; x <= width; x += 72) {
    const y = height * 0.47 + Math.sin(x * 0.012 + travel * 0.018) * 38;
    context.lineTo(x, y);
  }
  context.lineTo(width, height * 0.72);
  context.lineTo(0, height * 0.72);
  context.closePath();
  context.fill();

  context.fillStyle = "#c6c4d2";
  context.fillRect(0, height * 0.58, width, height * 0.16);
  context.strokeStyle = "#9693aa";
  context.lineWidth = 4;
  for (let index = -1; index < width / 145 + 2; index += 1) {
    const x = index * 156 - ((travel * 41) % 156);
    context.beginPath();
    context.ellipse(x, height * 0.65, 44, 13, 0, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = "#aaa7bb55";
    context.beginPath();
    context.ellipse(x + 48, height * 0.61, 15, 6, 0, 0, Math.PI * 2);
    context.fill();
  }
}
function drawTrack(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  travel: number,
  accent: string,
): void {
  const railY = height * 0.72;
  const horizonX = width * 0.76;
  const horizonY = height * 0.49;

  context.save();
  context.globalAlpha = 0.23;
  context.strokeStyle = accent;
  context.lineWidth = 2;
  for (const edge of [-0.08, 0.18, 0.46, 0.76, 1.06]) {
    context.beginPath();
    context.moveTo(width * edge, height);
    context.lineTo(horizonX, horizonY);
    context.stroke();
  }
  const phase = ((travel * 0.013) % 1 + 1) % 1;
  for (let index = 0; index < 8; index += 1) {
    const depth = Math.pow((index + phase) / 8, 2);
    const y = horizonY + (height - horizonY) * depth;
    const halfWidth = width * 0.72 * depth;
    context.beginPath();
    context.moveTo(horizonX - halfWidth, y);
    context.lineTo(horizonX + halfWidth, y);
    context.stroke();
  }
  context.restore();

  const ballast = context.createLinearGradient(0, railY + 24, 0, height);
  ballast.addColorStop(0, "#244a5a");
  ballast.addColorStop(1, "#071827");
  context.fillStyle = ballast;
  context.fillRect(0, railY + 31, width, height - railY - 31);

  context.save();
  context.shadowColor = accent;
  context.shadowBlur = 13;
  const rail = context.createLinearGradient(0, railY - 10, 0, railY + 34);
  rail.addColorStop(0, "#d7fbff");
  rail.addColorStop(0.36, accent);
  rail.addColorStop(1, "#16384d");
  context.fillStyle = rail;
  context.fillRect(0, railY - 9, width, 9);
  context.fillRect(0, railY + 23, width, 9);
  context.restore();

  context.fillStyle = "#f5d16a";
  const offset = -((travel * 110) % 76);
  for (let x = offset; x < width + 80; x += 76) {
    context.fillRect(x, railY - 13, 12, 51);
    context.fillStyle = "#102d40";
    context.fillRect(x + 3, railY - 6, 6, 37);
    context.fillStyle = "#f5d16a";
  }
}

function drawRouteBranch(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  lane: number,
  accent: string,
): void {
  if (lane === 0) return;
  const railY = height * 0.72;
  const offset = lane * 18;
  const mergeX = width * 0.58;
  context.save();
  context.strokeStyle = accent;
  context.lineWidth = 5;
  for (const railOffset of [-8, 23]) {
    context.beginPath();
    context.moveTo(0, railY + railOffset + offset);
    context.bezierCurveTo(
      width * 0.22,
      railY + railOffset + offset,
      width * 0.4,
      railY + railOffset,
      mergeX,
      railY + railOffset,
    );
    context.stroke();
  }
  context.fillStyle = accent;
  for (let x = 10; x < mergeX; x += 42) {
    const mergeProgress = Math.min(1, x / mergeX);
    const sleeperOffset = offset * (1 - mergeProgress * mergeProgress);
    context.fillRect(x, railY - 12 + sleeperOffset, 7, 48);
  }
  context.restore();
}

function drawTrain(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  stage: StageDefinition,
  energy: number,
  pulse: number,
  trainColor: string,
  bank: number,
  driveActive: boolean,
): void {
  context.save();
  context.translate(x, y - pulse * 4);
  context.rotate(bank);
  context.scale(scale, scale);

  context.fillStyle = "#07182788";
  context.beginPath();
  context.ellipse(58, 62, 112, 17, 0, 0, Math.PI * 2);
  context.fill();

  if (energy > 58 || driveActive) {
    const trail = context.createLinearGradient(-158, 0, -4, 0);
    trail.addColorStop(0, "rgba(99, 222, 208, 0)");
    trail.addColorStop(1, stage.colors.highlight + "a8");
    context.fillStyle = trail;
    roundedRect(context, -155, 24, 150, 12 + pulse * 5, 7);
    context.fill();
  }
  context.shadowColor = stage.colors.highlight;
  context.shadowBlur = energy > 52 || driveActive ? 14 + pulse * 12 : 0;

  if (energy > 52 || driveActive) {
    context.fillStyle = stage.colors.highlight + "66";
    context.beginPath();
    context.ellipse(10, 45, 122 + pulse * 16, 68 + pulse * 10, 0, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = "#f6fbf8b8";
  for (let index = 0; index < 3; index += 1) {
    context.beginPath();
    context.arc(84 - index * 13, -50 - index * 10, 8 + index * 3, 0, Math.PI * 2);
    context.fill();
  }

  const body = context.createLinearGradient(0, -22, 0, 52);
  body.addColorStop(0, "#f6fbf8");
  body.addColorStop(0.13, trainColor);
  body.addColorStop(0.72, trainColor);
  body.addColorStop(1, "#102c40");
  context.fillStyle = body;
  roundedRect(context, -10, -20, 118, 70, 12);
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = "#102c40";
  context.lineWidth = 4;
  context.stroke();
  context.fillStyle = stage.colors.highlight;
  context.fillRect(-10, 33, 118, 8);
  context.fillStyle = "#f6fbf8";
  roundedRect(context, 16, -5, 55, 30, 7);
  context.fill();
  context.fillStyle = "#17344a";
  roundedRect(context, 23, 1, 18, 18, 4);
  context.fill();
  roundedRect(context, 46, 1, 18, 18, 4);
  context.fill();
  context.fillStyle = "#f6fbf8";
  context.beginPath();
  context.arc(89, 10, 11, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#17344a";
  context.font = "900 10px sans-serif";
  context.textAlign = "center";
  context.fillText("R", 89, 14);
  context.fillStyle = stage.colors.highlight;
  context.beginPath();
  context.moveTo(108, -9);
  context.lineTo(142, 14);
  context.lineTo(142, 50);
  context.lineTo(104, 50);
  context.closePath();
  context.fill();

  context.fillStyle = "#17344a";
  context.fillRect(74, -39, 18, 24);
  context.fillStyle = "#eef9f6";
  context.beginPath();
  context.arc(130, 18, 8 + pulse * 2, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#18364a";
  context.beginPath();
  context.arc(24, 53, 18, 0, Math.PI * 2);
  context.arc(96, 53, 18, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = stage.colors.highlight;
  context.lineWidth = 5;
  context.beginPath();
  context.arc(24, 53, 9, 0, Math.PI * 2);
  context.arc(96, 53, 9, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = "#f6fbf8";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(28, 53);
  context.lineTo(92, 53);
  context.stroke();
  context.restore();
}

type TargetMode = "press" | "hold" | "release" | "repeat" | "rest" | "switch" | "listen";

interface TargetGuide {
  time: number | null;
  label: string;
  mode: TargetMode;
}

function targetYForScene(railY: number, height: number): number {
  return railY - Math.max(36, height * 0.09);
}

function getTargetGuide(notes: RuntimeNote[], playhead: number): TargetGuide {
  const heldBeam = notes.find((note) => note.type === "beam" && note.state === "holding");
  if (heldBeam) {
    return { time: heldBeam.time + heldBeam.duration, label: "ここで はなす", mode: "release" };
  }

  const activeQuiet = notes.find(
    (note) => note.type === "quiet" && playhead >= note.time && playhead < note.time + note.duration,
  );
  if (activeQuiet) {
    return { time: activeQuiet.time + activeQuiet.duration, label: "いまは おさない", mode: "rest" };
  }

  const activeBooster = notes.find(
    (note) => note.type === "booster" && playhead >= note.time && playhead < note.time + note.duration,
  );
  if (activeBooster) {
    const targetHits = Math.max(1, activeBooster.targetHits ?? 4);
    const interval = activeBooster.duration / targetHits;
    const nextSlot = Array.from({ length: targetHits }, (_, index) => index).find((index) => {
      const slotTime = activeBooster.time + interval * index;
      return !activeBooster.boosterHitSlots.includes(index) && slotTime >= playhead - interval * 0.2;
    });
    return {
      time: nextSlot === undefined ? activeBooster.time + activeBooster.duration : activeBooster.time + interval * nextSlot,
      label: "ひかるたび おす",
      mode: "repeat",
    };
  }

  const next = [...notes]
    .filter((note) => note.state === "pending" && note.time >= playhead - 0.28)
    .sort((a, b) => a.time - b.time)[0];
  if (!next) return { time: null, label: "おとを きこう", mode: "listen" };
  if (next.type === "quiet") return { time: next.time, label: "ここは おやすみ", mode: "rest" };
  if (next.type === "beam") return { time: next.time, label: "ここで ながおし", mode: "hold" };
  if (next.type === "booster") return { time: next.time, label: "ひかるたび おす", mode: "repeat" };
  if (next.type === "switch") {
    return { time: next.time, label: next.direction === "left" ? "← を おす" : "→ を おす", mode: "switch" };
  }
  return { time: next.time, label: "ここで おす", mode: "press" };
}

function drawHitTarget(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  guide: TargetGuide,
  playhead: number,
  bpm: number,
  beatPulse: number,
  hitPulse: number,
  accent: string,
  highlight: string,
  reducedMotion: boolean,
): void {
  const isRest = guide.mode === "rest";
  const ringColor = isRest ? "#9db2b8" : accent;
  const beatSeconds = 60 / bpm;
  const delta = guide.time === null ? Number.POSITIVE_INFINITY : guide.time - playhead;
  const approachWindow = beatSeconds * 2;
  const approach = Math.max(0, Math.min(1, 1 - delta / approachWindow));

  context.save();
  context.lineCap = "round";

  if (!reducedMotion && !isRest && delta >= -beatSeconds * 0.2 && delta <= approachWindow) {
    const approachRadius = radius + (1 - approach) * 34;
    context.globalAlpha = 0.22 + approach * 0.72;
    context.strokeStyle = highlight;
    context.lineWidth = 3.5;
    context.beginPath();
    context.arc(x, y, approachRadius, 0, Math.PI * 2);
    context.stroke();
  }

  if (!reducedMotion) {
    context.globalAlpha = 0.16 + beatPulse * 0.4;
    context.strokeStyle = highlight;
    context.lineWidth = 5 + beatPulse * 3;
    context.beginPath();
    context.arc(x, y, radius + 7 + beatPulse * 7, 0, Math.PI * 2);
    context.stroke();
  }

  context.globalAlpha = 0.7;
  context.strokeStyle = "#071827";
  context.lineWidth = 9;
  context.setLineDash([1, 10]);
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.stroke();

  context.globalAlpha = 1;
  context.strokeStyle = ringColor;
  context.lineWidth = 5;
  context.shadowColor = isRest ? "#9db2b8" : highlight;
  context.shadowBlur = 8 + hitPulse * 13;
  context.setLineDash([1, 10]);
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);

  if (isRest) {
    context.strokeStyle = "#f6fbf8";
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(x - radius * 0.45, y - radius * 0.45);
    context.lineTo(x + radius * 0.45, y + radius * 0.45);
    context.stroke();
  }

  if (hitPulse > 0.08) {
    context.globalAlpha = Math.min(0.42, hitPulse * 0.34);
    context.fillStyle = highlight;
    context.beginPath();
    context.arc(x, y, radius - 5, 0, Math.PI * 2);
    context.fill();
  }

  context.globalAlpha = 1;
  context.shadowBlur = 0;
  context.font = "900 13px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  const labelWidth = Math.max(82, context.measureText(guide.label).width + 22);
  roundedRect(context, x - labelWidth / 2, y - radius - 38, labelWidth, 27, 9);
  context.fillStyle = "rgba(7, 24, 39, 0.9)";
  context.fill();
  context.strokeStyle = ringColor;
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = "#f6fbf8";
  context.fillText(guide.label, x, y - radius - 24);
  context.restore();
}

function drawNote(
  context: CanvasRenderingContext2D,
  note: RuntimeNote,
  x: number,
  y: number,
  pixelsPerSecond: number,
  stage: StageDefinition,
): void {
  context.save();
  context.translate(x, y);
  context.shadowColor = note.type === "quiet" ? stage.colors.accent : stage.colors.highlight;
  context.shadowBlur = note.type === "quiet" ? 8 : 16;
  const size = note.type === "spark" ? 19 : 23;

  if (note.type === "spark") {
    context.rotate(Math.PI / 4);
    context.fillStyle = stage.colors.highlight;
    roundedRect(context, -size, -size, size * 2, size * 2, 5);
    context.fill();
    context.strokeStyle = "#17344a";
    context.lineWidth = 4;
    context.stroke();
    context.rotate(-Math.PI / 4);
    context.fillStyle = "#17344a";
    context.beginPath();
    context.arc(0, 0, 5, 0, Math.PI * 2);
    context.fill();
  } else if (note.type === "beam") {
    const beamEndX = note.duration * pixelsPerSecond;
    const beamWidth = Math.max(70, beamEndX);
    context.fillStyle = note.state === "holding" ? "#f6fbf8" : "#63ded0";
    roundedRect(context, -18, -16, beamWidth + 36, 32, 16);
    context.fill();
    context.strokeStyle = "#17344a";
    context.lineWidth = 4;
    context.stroke();
    context.fillStyle = stage.colors.accent;
    context.beginPath();
    context.arc(0, 0, 13, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(beamEndX, 0, 12, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#f6fbf8";
    context.lineWidth = 3;
    context.stroke();
  } else if (note.type === "switch") {
    context.fillStyle = "#f6fbf8";
    context.beginPath();
    if (note.direction === "left") {
      context.moveTo(-28, 0);
      context.lineTo(7, -24);
      context.lineTo(7, -9);
      context.lineTo(28, -9);
      context.lineTo(28, 9);
      context.lineTo(7, 9);
      context.lineTo(7, 24);
    } else {
      context.moveTo(28, 0);
      context.lineTo(-7, -24);
      context.lineTo(-7, -9);
      context.lineTo(-28, -9);
      context.lineTo(-28, 9);
      context.lineTo(-7, 9);
      context.lineTo(-7, 24);
    }
    context.closePath();
    context.fill();
    context.strokeStyle = stage.colors.accent;
    context.lineWidth = 5;
    context.stroke();
  } else if (note.type === "booster") {
    const rhythmWidth = note.duration * pixelsPerSecond;
    const boosterWidth = Math.max(90, rhythmWidth);
    context.fillStyle = stage.colors.accent + "cc";
    roundedRect(context, -18, -22, boosterWidth + 36, 44, 6);
    context.fill();
    const targetHits = Math.max(1, note.targetHits ?? 4);
    for (let index = 0; index < targetHits; index += 1) {
      const offset = rhythmWidth * index / targetHits;
      const isHit = note.boosterHitSlots.includes(index);
      context.fillStyle = isHit ? "#17344a" : stage.colors.highlight;
      context.beginPath();
      context.arc(offset, 0, 11, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "#f6fbf8";
      context.lineWidth = 3;
      context.stroke();
    }
  } else {
    const quietWidth = Math.max(100, note.duration * pixelsPerSecond);
    context.fillStyle = "#f6fbf8cc";
    roundedRect(context, -14, -34, quietWidth + 28, 68, 6);
    context.fill();
    context.strokeStyle = "#17344a";
    context.lineWidth = 3;
    context.setLineDash([10, 9]);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = "#17344a";
    context.font = "700 16px sans-serif";
    context.textAlign = "center";
    context.fillText("しずかに", quietWidth / 2, 6);
  }
  context.restore();
}

function drawSpeedAtmosphere(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: SceneState,
): void {
  if (state.reducedMotion || (state.energy < 48 && !state.driveActive)) return;
  const strength = Math.max(0.15, Math.min(1, state.effectsStrength));
  const phase = state.playhead * (90 + state.energy * 1.7);
  context.save();
  context.strokeStyle = state.stage.colors.highlight;
  context.lineCap = "round";
  for (let index = 0; index < 14; index += 1) {
    const cycle = width + 260;
    const rawX = index * 157 - phase;
    const x = ((rawX % cycle) + cycle) % cycle - 130;
    const y = height * (0.08 + ((index * 37) % 72) / 100);
    const length = 34 + (index % 5) * 22 + state.energy * 0.3;
    context.globalAlpha = (0.05 + (index % 4) * 0.035) * strength;
    context.lineWidth = 1 + (index % 3);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + length, y);
    context.stroke();
  }
  context.restore();
}

function drawFlowDrive(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: SceneState,
): void {
  if (!state.driveActive) return;
  const horizonX = width * 0.76;
  const horizonY = height * 0.49;
  const strength = Math.max(0.35, Math.min(1, state.effectsStrength));
  const motion = state.reducedMotion ? 0 : state.playhead;
  context.save();
  context.globalCompositeOperation = "lighter";
  const glow = context.createRadialGradient(horizonX, horizonY, 4, horizonX, horizonY, width * 0.72);
  glow.addColorStop(0, state.stage.colors.highlight + "a8");
  glow.addColorStop(0.18, state.stage.colors.accent + "4f");
  glow.addColorStop(0.6, "rgba(99, 222, 208, 0.08)");
  glow.addColorStop(1, "rgba(4, 15, 28, 0)");
  context.globalAlpha = (0.72 + state.driveProgress * 0.28) * strength;
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  const maxRadius = Math.max(width, height) * 0.72;
  context.lineWidth = 3;
  for (let index = 0; index < 7; index += 1) {
    const phase = ((motion * 1.7 + index / 7) % 1 + 1) % 1;
    const radius = 24 + phase * maxRadius;
    context.globalAlpha = (1 - phase) * 0.34 * strength;
    context.strokeStyle = index % 2 ? state.stage.colors.highlight : state.stage.colors.accent;
    context.beginPath();
    context.ellipse(horizonX, horizonY, radius, radius * 0.55, 0, 0, Math.PI * 2);
    context.stroke();
  }

  context.globalAlpha = 0.22 * strength;
  context.strokeStyle = "#d9fff8";
  context.lineWidth = 2;
  for (let index = 0; index < 11; index += 1) {
    const edgeX = (index / 10) * width;
    const edgeY = index % 2 === 0 ? height : height * 0.05;
    context.beginPath();
    context.moveTo(horizonX, horizonY);
    context.lineTo(edgeX, edgeY);
    context.stroke();
  }
  context.restore();
}
function drawScene(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: SceneState,
): void {
  const strength = Math.max(0.25, Math.min(1, state.effectsStrength));
  const baseTravel = state.playhead * 8;
  const fullTravel = state.playhead * (52 + state.energy * 0.42) * (state.driveActive ? 1.38 : 1);
  const travel = state.reducedMotion ? baseTravel : baseTravel + (fullTravel - baseTravel) * strength;
  if (state.stage.theme === "city") drawCity(context, width, height, travel);
  else if (state.stage.theme === "jungle") drawJungle(context, width, height, travel);
  else drawMoon(context, width, height, travel);

  drawFlowDrive(context, width, height, state);
  drawSpeedAtmosphere(context, width, height, state);
  drawTrack(context, width, height, travel, state.stage.colors.highlight);
  const railY = height * 0.72;
  if (!state.titleMode) drawRouteBranch(context, width, height, state.routeLane, state.stage.colors.highlight);
  const trainX = state.titleMode ? width * 0.32 : width * 0.05;
  const trainScale = Math.max(0.68, Math.min(1.15, width / 960));
  const targetX = Math.min(
    width * 0.42,
    Math.max(width * 0.24, trainX + 148 * trainScale + 20),
  );
  const targetY = targetYForScene(railY, height);

  if (!state.titleMode) {
    const pixelsPerSecond = (width - targetX - 32) / state.travelTime;
    for (const note of state.notes) {
      const x = targetX + (note.time - state.playhead) * pixelsPerSecond;
      drawNote(context, note, x, targetY, pixelsPerSecond, state.stage);
    }
    const targetGuide = getTargetGuide(state.notes, state.playhead);
    drawHitTarget(
      context,
      targetX,
      targetY,
      Math.max(28, Math.min(38, height * 0.07)),
      targetGuide,
      state.playhead,
      state.stage.bpm,
      rhythmPulseAt(state.playhead, state.stage.bpm),
      state.pulse * strength,
      state.stage.colors.accent,
      state.stage.colors.highlight,
      state.reducedMotion,
    );
  }

  const shakeX = state.shake ? Math.sin(state.playhead * 90) * state.shake * 5 * strength : 0;
  const bank = state.reducedMotion ? 0 : state.routeLane * 0.018 + Math.sin(state.playhead * 3.4) * (state.driveActive ? 0.026 : 0.012) * strength;
  drawTrain(context, trainX + shakeX, railY - 62 + state.routeLane * 18, trainScale, state.stage, state.energy, state.pulse * strength, state.trainColor, bank, state.driveActive);

  const activeEvent = [...state.stage.events].reverse().find((event) => state.playhead >= event.time);
  if (activeEvent && !state.titleMode) {
    context.fillStyle = "#f6fbf8de";
    roundedRect(context, width - 190, 24, 166, 38, 5);
    context.fill();
    context.fillStyle = "#17344a";
    context.font = "700 15px sans-serif";
    context.textAlign = "center";
    context.fillText(activeEvent.target, width - 107, 49);
  }
}

function useCanvasLoop(getState: () => SceneState): React.RefObject<HTMLCanvasElement | null> {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const getStateRef = useRef(getState);

  useEffect(() => {
    getStateRef.current = getState;
  }, [getState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let frame = 0;
    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.max(1, Math.round(rect.width * ratio));
      const pixelHeight = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);
      drawScene(context, rect.width, rect.height, getStateRef.current());
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);

  return canvasRef;
}

export function GameCanvas(props: GameCanvasProps) {
  const canvasRef = useCanvasLoop(() => {
    const livePlayhead = props.getPlayhead();
    return {
      stage: props.stage,
      playhead: livePlayhead,
      travelTime: props.travelTime,
      notes: props.session.chart.visible(livePlayhead, props.travelTime),
      energy: props.effects.energy,
      pulse: props.effects.pulse,
      shake: props.effects.shake,
      driveActive: props.effects.overdrive,
      driveProgress: props.effects.driveProgress,
      reducedMotion: props.reducedMotion,
      effectsStrength: props.effectsStrength,
      routeLane: props.routeLane,
      titleMode: false,
      trainColor: props.trainColor,
    };
  });
  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      aria-label={props.stage.name + "を はしっているよ。ひかりが ○に かさなったら おそう"}
    />
  );
}

export function AttractCanvas() {
  const startedAt = useRef(0);
  const reducedMotionRef = useRef(false);
  useEffect(() => observeMediaQuery(
    "(prefers-reduced-motion: reduce)",
    (matches) => { reducedMotionRef.current = matches; },
  ), []);

  const canvasRef = useCanvasLoop(() => {
    const now = performance.now() / 1000;
    if (!startedAt.current) startedAt.current = now;
    const playhead = now - startedAt.current;
    return {
      stage: STAGES[0],
      playhead,
      travelTime: 4,
      notes: [],
      energy: 76,
      pulse: (Math.sin(playhead * Math.PI * 2 * 1.6) + 1) * 0.2,
      shake: 0,
      driveActive: false,
      driveProgress: 0,
      reducedMotion: reducedMotionRef.current,
      effectsStrength: 1,
      routeLane: 0,
      titleMode: true,
      trainColor: STAGES[0].colors.accent,
    };
  });
  return <canvas ref={canvasRef} className="attract-canvas" aria-label="あさの まちを はしる リズムれっしゃ" />;
}