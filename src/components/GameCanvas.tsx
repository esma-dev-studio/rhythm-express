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

type TargetMode = "press" | "hold" | "release" | "repeat" | "rest" | "switch" | "listen";

interface TargetGuide {
  time: number | null;
  label: string;
  mode: TargetMode;
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

interface CabGeometry {
  vanishX: number;
  horizonY: number;
  dashboardY: number;
  targetY: number;
}

interface ScenePalette {
  skyTop: string;
  skyMiddle: string;
  skyHorizon: string;
  landFar: string;
  landNear: string;
  structure: string;
  structureLight: string;
  rail: string;
  ballast: string;
  cabTop: string;
  cabBottom: string;
}

const SCENE_PALETTES: Record<StageDefinition["theme"], ScenePalette> = {
  city: {
    skyTop: "#416f86", skyMiddle: "#9bbbc0", skyHorizon: "#e6c39a",
    landFar: "#667564", landNear: "#263a34", structure: "#53636a",
    structureLight: "#d4c399", rail: "#c7ceca", ballast: "#3c4848",
    cabTop: "#252d2f", cabBottom: "#111719",
  },
  jungle: {
    skyTop: "#315d65", skyMiddle: "#6f9690", skyHorizon: "#c4b989",
    landFar: "#3f5d4a", landNear: "#182c24", structure: "#30493b",
    structureLight: "#b0a66f", rail: "#bcc7c0", ballast: "#37443d",
    cabTop: "#26302c", cabBottom: "#101713",
  },
  moon: {
    skyTop: "#050a17", skyMiddle: "#111b35", skyHorizon: "#33405b",
    landFar: "#626873", landNear: "#272c36", structure: "#4d5664",
    structureLight: "#a9d9dd", rail: "#c8d0d5", ballast: "#343a45",
    cabTop: "#20262d", cabBottom: "#0d1117",
  },
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function getCabGeometry(width: number, height: number, state: SceneState): CabGeometry {
  const laneOffset = state.titleMode ? 0 : state.routeLane * width * 0.032;
  const horizonY = height * (state.titleMode ? 0.39 : 0.35);
  const dashboardY = height * (state.titleMode ? 0.91 : 0.86);
  return {
    vanishX: width * 0.5 - laneOffset,
    horizonY,
    dashboardY,
    targetY: dashboardY - Math.max(24, height * 0.055),
  };
}

function trackCenterAt(geometry: CabGeometry, width: number, depth: number): number {
  return mix(geometry.vanishX, width * 0.5, Math.pow(clamp01(depth), 1.42));
}

function trackHalfWidthAt(width: number, depth: number): number {
  return mix(3, width * 0.245, Math.pow(clamp01(depth), 1.55));
}

function pointOnTrack(
  geometry: CabGeometry,
  width: number,
  depth: number,
): { x: number; y: number; half: number } {
  const eased = Math.pow(clamp01(depth), 1.68);
  return {
    x: trackCenterAt(geometry, width, depth),
    y: mix(geometry.horizonY, geometry.targetY, eased),
    half: trackHalfWidthAt(width, depth),
  };
}

function drawCloudBank(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  travel: number,
  alpha: number,
): void {
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = "#f4f1e7";
  const drift = -((travel * 0.035) % 260);
  for (let index = -1; index < width / 250 + 2; index += 1) {
    const x = drift + index * 260;
    const y = height * (0.1 + ((index + 8) % 3) * 0.055);
    context.beginPath();
    context.ellipse(x, y, 42, 13, 0, 0, Math.PI * 2);
    context.ellipse(x + 38, y - 9, 33, 20, 0, 0, Math.PI * 2);
    context.ellipse(x + 78, y + 2, 48, 16, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawCityHorizon(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  geometry: CabGeometry,
  travel: number,
  palette: ScenePalette,
): void {
  const baseY = geometry.horizonY + height * 0.055;
  const drift = -((travel * 0.016) % 86);
  context.save();
  for (let index = -2; index < width / 72 + 3; index += 1) {
    const x = drift + index * 86;
    const buildingWidth = 52 + ((index + 12) % 3) * 12;
    const buildingHeight = height * (0.09 + ((index + 16) % 5) * 0.018);
    const wall = context.createLinearGradient(x, 0, x + buildingWidth, 0);
    wall.addColorStop(0, "#3b4b52");
    wall.addColorStop(0.78, palette.structure);
    wall.addColorStop(1, "#2d3a40");
    context.fillStyle = wall;
    context.fillRect(x, baseY - buildingHeight, buildingWidth, buildingHeight);
    context.fillStyle = "rgba(233, 207, 145, 0.46)";
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        if ((row + column + index) % 3 === 0) continue;
        context.fillRect(
          x + 9 + column * (buildingWidth - 18) / 3,
          baseY - buildingHeight + 12 + row * 16,
          Math.max(4, buildingWidth * 0.08), 5,
        );
      }
    }
  }
  context.fillStyle = "rgba(26, 38, 39, 0.42)";
  context.fillRect(0, baseY - 2, width, height * 0.055);
  context.restore();
}

function drawJungleHorizon(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  geometry: CabGeometry,
  travel: number,
): void {
  context.save();
  const ridgeY = geometry.horizonY + height * 0.04;
  context.fillStyle = "rgba(40, 65, 53, 0.72)";
  context.beginPath();
  context.moveTo(0, ridgeY);
  for (let x = 0; x <= width + 80; x += 70) {
    context.lineTo(x, ridgeY - height * (0.08 + 0.035 * Math.sin(x * 0.011 + travel * 0.001)));
  }
  context.lineTo(width, ridgeY + height * 0.12);
  context.lineTo(0, ridgeY + height * 0.12);
  context.closePath();
  context.fill();
  context.fillStyle = "rgba(23, 47, 37, 0.78)";
  context.beginPath();
  context.moveTo(0, ridgeY + height * 0.02);
  for (let x = 0; x <= width + 60; x += 42) {
    context.lineTo(x, ridgeY - height * (0.025 + 0.035 * Math.abs(Math.sin(x * 0.023))));
  }
  context.lineTo(width, ridgeY + height * 0.13);
  context.lineTo(0, ridgeY + height * 0.13);
  context.closePath();
  context.fill();
  context.restore();
}

function drawMoonHorizon(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  geometry: CabGeometry,
  travel: number,
): void {
  context.save();
  context.fillStyle = "#d8e4e8";
  for (let index = 0; index < 54; index += 1) {
    const rawX = index * 137 - travel * (0.12 + (index % 4) * 0.02);
    const x = ((rawX % (width + 30)) + width + 30) % (width + 30);
    const y = 16 + (index * 61) % Math.max(30, Math.floor(geometry.horizonY - 30));
    context.globalAlpha = index % 7 === 0 ? 0.85 : 0.35;
    context.beginPath();
    context.arc(x, y, index % 7 === 0 ? 1.8 : 0.9, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 0.85;
  const earthX = width * 0.78 - ((travel * 0.006) % (width * 0.12));
  const earthY = height * 0.16;
  const radius = Math.min(width, height) * 0.07;
  const earth = context.createRadialGradient(
    earthX - radius * 0.3, earthY - radius * 0.35, 2, earthX, earthY, radius,
  );
  earth.addColorStop(0, "#d4f2f0");
  earth.addColorStop(0.45, "#5a9eb2");
  earth.addColorStop(1, "#243d59");
  context.fillStyle = earth;
  context.beginPath();
  context.arc(earthX, earthY, radius, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
  context.fillStyle = "#555b68";
  context.beginPath();
  context.moveTo(0, geometry.horizonY + height * 0.045);
  for (let x = 0; x <= width + 65; x += 64) {
    context.lineTo(x, geometry.horizonY - height * (0.01 + Math.abs(Math.sin(x * 0.018)) * 0.07));
  }
  context.lineTo(width, geometry.horizonY + height * 0.14);
  context.lineTo(0, geometry.horizonY + height * 0.14);
  context.closePath();
  context.fill();
  context.restore();
}

function drawPerspectiveBackdrop(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  travel: number,
  state: SceneState,
  geometry: CabGeometry,
  palette: ScenePalette,
): void {
  const sky = context.createLinearGradient(0, 0, 0, geometry.horizonY + height * 0.18);
  sky.addColorStop(0, palette.skyTop);
  sky.addColorStop(0.58, palette.skyMiddle);
  sky.addColorStop(1, palette.skyHorizon);
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);
  if (state.stage.theme !== "moon") {
    const sunX = width * (state.stage.theme === "city" ? 0.76 : 0.23);
    const sunY = height * 0.16;
    const sunRadius = Math.min(width, height) * 0.052;
    const haze = context.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius * 4);
    haze.addColorStop(0, "rgba(255, 232, 174, 0.88)");
    haze.addColorStop(0.25, "rgba(255, 215, 146, 0.3)");
    haze.addColorStop(1, "rgba(255, 215, 146, 0)");
    context.fillStyle = haze;
    context.fillRect(0, 0, width, geometry.horizonY + height * 0.2);
    drawCloudBank(context, width, height, travel, state.stage.theme === "city" ? 0.3 : 0.17);
  }
  if (state.stage.theme === "city") drawCityHorizon(context, width, height, geometry, travel, palette);
  else if (state.stage.theme === "jungle") drawJungleHorizon(context, width, height, geometry, travel);
  else drawMoonHorizon(context, width, height, geometry, travel);
  const land = context.createLinearGradient(0, geometry.horizonY, 0, height);
  land.addColorStop(0, palette.landFar);
  land.addColorStop(1, palette.landNear);
  context.fillStyle = land;
  context.fillRect(0, geometry.horizonY, width, height - geometry.horizonY);
  const horizonMist = context.createLinearGradient(0, geometry.horizonY - 12, 0, geometry.horizonY + height * 0.17);
  horizonMist.addColorStop(0, "rgba(236, 230, 204, 0.22)");
  horizonMist.addColorStop(1, "rgba(236, 230, 204, 0)");
  context.fillStyle = horizonMist;
  context.fillRect(0, geometry.horizonY - 12, width, height * 0.2);
}

function drawPerspectiveTrack(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  travel: number,
  state: SceneState,
  geometry: CabGeometry,
  palette: ScenePalette,
): void {
  const bottomCenter = trackCenterAt(geometry, width, 1);
  const bottomHalf = trackHalfWidthAt(width, 1);
  context.save();
  const ballast = context.createLinearGradient(0, geometry.horizonY, 0, geometry.dashboardY);
  ballast.addColorStop(0, palette.ballast);
  ballast.addColorStop(1, "#171c1d");
  context.fillStyle = ballast;
  context.beginPath();
  context.moveTo(geometry.vanishX - 8, geometry.horizonY);
  context.lineTo(geometry.vanishX + 8, geometry.horizonY);
  context.lineTo(bottomCenter + bottomHalf * 1.72, geometry.dashboardY);
  context.lineTo(bottomCenter - bottomHalf * 1.72, geometry.dashboardY);
  context.closePath();
  context.fill();
  const sleeperPhase = ((travel * 0.0024) % 1 + 1) % 1;
  for (let index = 0; index < 20; index += 1) {
    const depth = ((index / 20 + sleeperPhase) % 1 + 1) % 1;
    const point = pointOnTrack(geometry, width, depth);
    const sleeperHalf = point.half * 1.42;
    context.strokeStyle = depth > 0.68 ? "#51483d" : "#6b6254";
    context.lineWidth = mix(1, 9, Math.pow(depth, 1.8));
    context.beginPath();
    context.moveTo(point.x - sleeperHalf, point.y);
    context.lineTo(point.x + sleeperHalf, point.y);
    context.stroke();
  }
  const railOffsets = [-0.62, 0.62];
  for (const railOffset of railOffsets) {
    const farX = geometry.vanishX + railOffset * 4;
    const nearX = bottomCenter + railOffset * bottomHalf;
    const railGradient = context.createLinearGradient(farX, geometry.horizonY, nearX, geometry.dashboardY);
    railGradient.addColorStop(0, "#77817e");
    railGradient.addColorStop(0.7, palette.rail);
    railGradient.addColorStop(1, "#e0e2dc");
    context.strokeStyle = "rgba(7, 12, 13, 0.78)";
    context.lineWidth = Math.max(7, width * 0.015);
    context.beginPath();
    context.moveTo(farX, geometry.horizonY);
    context.lineTo(nearX, geometry.dashboardY);
    context.stroke();
    context.strokeStyle = railGradient;
    context.lineWidth = Math.max(2, width * 0.0055);
    context.beginPath();
    context.moveTo(farX, geometry.horizonY);
    context.lineTo(nearX, geometry.dashboardY);
    context.stroke();
  }
  if (state.routeLane !== 0 && !state.titleMode) {
    const split = pointOnTrack(geometry, width, 0.56);
    const direction = state.routeLane;
    context.strokeStyle = palette.rail;
    context.lineWidth = Math.max(2, width * 0.004);
    context.beginPath();
    context.moveTo(split.x, split.y);
    context.quadraticCurveTo(
      split.x + direction * width * 0.18,
      mix(split.y, geometry.dashboardY, 0.5),
      width * (0.5 + direction * 0.42),
      geometry.dashboardY,
    );
    context.stroke();
  }
  context.restore();
}

function drawRoadsideObjects(
  context: CanvasRenderingContext2D,
  width: number,
  travel: number,
  state: SceneState,
  geometry: CabGeometry,
  palette: ScenePalette,
): void {
  const phase = ((travel * 0.0015) % 1 + 1) % 1;
  const depths = Array.from({ length: 11 }, (_, index) => ((index / 11 + phase) % 1 + 1) % 1)
    .sort((a, b) => a - b);
  context.save();
  for (let index = 0; index < depths.length; index += 1) {
    const depth = depths[index];
    const point = pointOnTrack(geometry, width, depth);
    const scale = mix(0.08, 1, Math.pow(depth, 1.65));
    for (const side of [-1, 1]) {
      const x = point.x + side * point.half * (1.72 + (index % 3) * 0.14);
      if (state.stage.theme === "city") {
        context.strokeStyle = "#293438";
        context.lineWidth = Math.max(1, 7 * scale);
        context.beginPath();
        context.moveTo(x, point.y);
        context.lineTo(x, point.y - 94 * scale);
        context.stroke();
        context.strokeStyle = "#48565a";
        context.lineWidth = Math.max(1, 3 * scale);
        context.beginPath();
        context.moveTo(x - 17 * scale, point.y - 82 * scale);
        context.lineTo(x + 17 * scale, point.y - 82 * scale);
        context.stroke();
        context.fillStyle = index % 4 === 0 ? "#d9b968" : "#8a9b9b";
        context.beginPath();
        context.arc(x, point.y - 92 * scale, Math.max(1.2, 5 * scale), 0, Math.PI * 2);
        context.fill();
      } else if (state.stage.theme === "jungle") {
        context.strokeStyle = "#20352a";
        context.lineWidth = Math.max(2, 18 * scale);
        context.beginPath();
        context.moveTo(x, point.y + 4 * scale);
        context.lineTo(x + side * 4 * scale, point.y - 82 * scale);
        context.stroke();
        const leaves = context.createRadialGradient(x, point.y - 91 * scale, 2, x, point.y - 91 * scale, 32 * scale);
        leaves.addColorStop(0, "#59785c");
        leaves.addColorStop(1, "#243f31");
        context.fillStyle = leaves;
        context.beginPath();
        context.ellipse(x, point.y - 92 * scale, 34 * scale, 25 * scale, 0, 0, Math.PI * 2);
        context.fill();
      } else {
        context.strokeStyle = "#273342";
        context.lineWidth = Math.max(1, 7 * scale);
        context.beginPath();
        context.moveTo(x, point.y);
        context.lineTo(x, point.y - 55 * scale);
        context.stroke();
        context.fillStyle = index % 3 === 0 ? state.stage.colors.highlight : palette.structureLight;
        context.beginPath();
        context.arc(x, point.y - 59 * scale, Math.max(1.2, 5 * scale), 0, Math.PI * 2);
        context.fill();
      }
    }
  }
  context.restore();
}

function noteDepthAt(delta: number, travelTime: number): number {
  return clamp01(1 - delta / Math.max(0.5, travelTime));
}

function drawSignalHousing(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  lamp: string,
  active: boolean,
): void {
  context.save();
  context.translate(x, y);
  context.fillStyle = "#182124";
  context.strokeStyle = "#6f7a79";
  context.lineWidth = Math.max(1, size * 0.1);
  roundedRect(context, -size * 0.72, -size * 0.92, size * 1.44, size * 1.84, size * 0.17);
  context.fill();
  context.stroke();
  context.shadowColor = lamp;
  context.shadowBlur = active ? size * 0.42 : size * 0.16;
  const light = context.createRadialGradient(-size * 0.18, -size * 0.2, 1, 0, 0, size * 0.58);
  light.addColorStop(0, "#fff7d0");
  light.addColorStop(0.32, lamp);
  light.addColorStop(1, "#5e512f");
  context.fillStyle = light;
  context.beginPath();
  context.arc(0, 0, size * 0.48, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawPerspectiveNote(
  context: CanvasRenderingContext2D,
  note: RuntimeNote,
  state: SceneState,
  geometry: CabGeometry,
  width: number,
): void {
  const delta = note.time - state.playhead;
  const depth = Math.pow(noteDepthAt(delta, state.travelTime), 1.05);
  const point = pointOnTrack(geometry, width, depth);
  const size = mix(5, Math.max(28, width * 0.035), Math.pow(depth, 1.55));
  const isClose = depth > 0.72;
  context.save();
  if (note.type === "beam") {
    const endDepth = Math.pow(noteDepthAt(note.time + note.duration - state.playhead, state.travelTime), 1.05);
    const endPoint = pointOnTrack(geometry, width, endDepth);
    context.strokeStyle = note.state === "holding" ? "#f7f0d0" : "#d6a64f";
    context.lineWidth = Math.max(3, size * 0.44);
    context.lineCap = "round";
    context.shadowColor = "#e2b85b";
    context.shadowBlur = isClose ? 10 : 3;
    context.beginPath();
    context.moveTo(endPoint.x, endPoint.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    drawSignalHousing(context, point.x, point.y, size * 0.82, "#e8b653", isClose);
    context.restore();
    return;
  }
  if (note.type === "booster") {
    const count = Math.max(3, note.targetHits ?? 4);
    const spacing = Math.max(3, size * 0.52);
    for (let index = 0; index < count; index += 1) {
      const hit = note.boosterHitSlots.includes(index);
      context.fillStyle = hit ? "#314345" : "#d7a955";
      context.shadowColor = "#d7a955";
      context.shadowBlur = hit ? 0 : isClose ? 8 : 2;
      context.beginPath();
      context.arc(point.x + (index - (count - 1) / 2) * spacing, point.y, Math.max(2, size * 0.18), 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    return;
  }
  if (note.type === "switch") {
    context.translate(point.x, point.y);
    context.fillStyle = "#172024";
    context.strokeStyle = "#9da6a2";
    context.lineWidth = Math.max(1, size * 0.09);
    roundedRect(context, -size * 0.72, -size * 0.62, size * 1.44, size * 1.24, size * 0.12);
    context.fill();
    context.stroke();
    context.strokeStyle = "#e4b95d";
    context.lineWidth = Math.max(2, size * 0.15);
    context.lineCap = "round";
    const direction = note.direction === "left" ? -1 : 1;
    context.beginPath();
    context.moveTo(-direction * size * 0.22, size * 0.26);
    context.lineTo(direction * size * 0.27, -size * 0.26);
    context.lineTo(direction * size * 0.27, size * 0.02);
    context.stroke();
    context.restore();
    return;
  }
  if (note.type === "quiet") {
    context.translate(point.x, point.y);
    context.fillStyle = "#202a2e";
    context.strokeStyle = "#8e9998";
    context.lineWidth = Math.max(1, size * 0.08);
    roundedRect(context, -size, -size * 0.55, size * 2, size * 1.1, size * 0.1);
    context.fill();
    context.stroke();
    context.fillStyle = "#d7e1dc";
    context.font = `800 ${Math.max(7, size * 0.43)}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("まつ", 0, 1);
    context.restore();
    return;
  }
  drawSignalHousing(context, point.x, point.y, size, "#e5b356", isClose);
  context.restore();
}

function drawTargetGate(
  context: CanvasRenderingContext2D,
  width: number,
  state: SceneState,
  geometry: CabGeometry,
): void {
  const guide = getTargetGuide(state.notes, state.playhead);
  const rest = guide.mode === "rest";
  const color = rest ? "#8fa0a0" : "#e6b85d";
  const beat = rhythmPulseAt(state.playhead, state.stage.bpm);
  const point = pointOnTrack(geometry, width, 1);
  const half = point.half * 1.12;
  context.save();
  context.strokeStyle = "rgba(10, 15, 16, 0.86)";
  context.lineWidth = 13;
  context.beginPath();
  context.moveTo(point.x - half, geometry.targetY);
  context.lineTo(point.x + half, geometry.targetY);
  context.stroke();
  context.strokeStyle = color;
  context.lineWidth = 4 + beat * 2.2;
  context.shadowColor = color;
  context.shadowBlur = rest ? 0 : 4 + beat * 7;
  context.beginPath();
  context.moveTo(point.x - half, geometry.targetY);
  context.lineTo(point.x + half, geometry.targetY);
  context.stroke();
  context.shadowBlur = 0;
  context.font = "900 13px sans-serif";
  const labelWidth = Math.max(92, context.measureText(guide.label).width + 34);
  context.fillStyle = "rgba(18, 25, 27, 0.94)";
  context.strokeStyle = "#8d9794";
  context.lineWidth = 1.5;
  roundedRect(context, point.x - labelWidth / 2, geometry.targetY - 39, labelWidth, 28, 4);
  context.fill();
  context.stroke();
  context.fillStyle = rest ? "#d7dfdc" : "#f2c76d";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(guide.label, point.x, geometry.targetY - 25);
  context.restore();
}

function drawCabFrame(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: SceneState,
  geometry: CabGeometry,
  palette: ScenePalette,
): void {
  context.save();
  const pillar = Math.max(20, width * 0.038);
  const frame = context.createLinearGradient(0, 0, pillar, 0);
  frame.addColorStop(0, palette.cabBottom);
  frame.addColorStop(0.52, palette.cabTop);
  frame.addColorStop(1, "#0b1011");
  context.fillStyle = frame;
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(pillar * 1.15, 0);
  context.lineTo(pillar * 0.72, geometry.dashboardY);
  context.lineTo(0, geometry.dashboardY);
  context.closePath();
  context.fill();
  context.save();
  context.translate(width, 0);
  context.scale(-1, 1);
  context.fillStyle = frame;
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(pillar * 1.15, 0);
  context.lineTo(pillar * 0.72, geometry.dashboardY);
  context.lineTo(0, geometry.dashboardY);
  context.closePath();
  context.fill();
  context.restore();
  const dashboard = context.createLinearGradient(0, geometry.dashboardY, 0, height);
  dashboard.addColorStop(0, "#3a4243");
  dashboard.addColorStop(0.16, palette.cabTop);
  dashboard.addColorStop(1, palette.cabBottom);
  context.fillStyle = dashboard;
  context.fillRect(0, geometry.dashboardY, width, height - geometry.dashboardY);
  context.fillStyle = state.trainColor;
  context.globalAlpha = 0.68;
  context.fillRect(0, geometry.dashboardY + 3, width, 3);
  context.globalAlpha = 1;
  const panelWidth = Math.min(250, width * 0.28);
  const panelX = width / 2 - panelWidth / 2;
  const panelY = geometry.dashboardY + 12;
  context.fillStyle = "#0b1112";
  context.strokeStyle = "#586160";
  context.lineWidth = 1.5;
  roundedRect(context, panelX, panelY, panelWidth, Math.max(35, height - panelY + 8), 5);
  context.fill();
  context.stroke();
  for (let index = 0; index < 5; index += 1) {
    const ledX = panelX + 30 + index * (panelWidth - 60) / 4;
    context.fillStyle = index < Math.ceil(state.energy / 20) ? "#d6a84f" : "#303a39";
    context.beginPath();
    context.arc(ledX, panelY + 15, 3.5, 0, Math.PI * 2);
    context.fill();
  }
  const glassShade = context.createRadialGradient(
    width * 0.5, height * 0.4, width * 0.12, width * 0.5, height * 0.48, width * 0.72,
  );
  glassShade.addColorStop(0, "rgba(255,255,255,0)");
  glassShade.addColorStop(0.74, "rgba(4,10,12,0.02)");
  glassShade.addColorStop(1, "rgba(3,8,10,0.32)");
  context.fillStyle = glassShade;
  context.fillRect(0, 0, width, geometry.dashboardY);
  context.globalAlpha = 0.18;
  context.strokeStyle = "#d7e7e5";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(width * 0.18, height * 0.08);
  context.lineTo(width * 0.38, height * 0.02);
  context.stroke();
  context.globalAlpha = 1;
  context.restore();
}

function drawCabSpeed(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: SceneState,
  geometry: CabGeometry,
): void {
  if (state.reducedMotion || (state.energy < 46 && !state.driveActive)) return;
  const strength = Math.min(1, state.effectsStrength) * (state.driveActive ? 1 : 0.55);
  const phase = state.playhead * (0.7 + state.energy * 0.012);
  context.save();
  context.strokeStyle = state.stage.theme === "moon" ? "#a9ced3" : "#ede1bf";
  context.lineCap = "round";
  for (let index = 0; index < 15; index += 1) {
    const angle = -1.18 + index * 0.17;
    const drift = ((phase + index * 0.071) % 1 + 1) % 1;
    const start = 18 + drift * Math.min(width, height) * 0.24;
    const length = 8 + drift * 42;
    context.globalAlpha = (0.025 + drift * 0.08) * strength;
    context.lineWidth = 1 + drift * 1.5;
    context.beginPath();
    context.moveTo(
      geometry.vanishX + Math.cos(angle) * start,
      geometry.horizonY + Math.sin(angle) * start * 0.58,
    );
    context.lineTo(
      geometry.vanishX + Math.cos(angle) * (start + length),
      geometry.horizonY + Math.sin(angle) * (start + length) * 0.58,
    );
    context.stroke();
  }
  context.restore();
}

function drawWorldRouteBoard(
  context: CanvasRenderingContext2D,
  width: number,
  state: SceneState,
  geometry: CabGeometry,
): void {
  const activeEvent = [...state.stage.events].reverse().find((event) => state.playhead >= event.time);
  if (!activeEvent || state.titleMode) return;
  const point = pointOnTrack(geometry, width, 0.28);
  const side = state.routeLane < 0 ? 1 : -1;
  const x = point.x + side * point.half * 3.6;
  const y = point.y - 28;
  context.save();
  context.strokeStyle = "#293233";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(x, y + 23);
  context.lineTo(x, y + 48);
  context.stroke();
  context.fillStyle = "rgba(26, 34, 35, 0.92)";
  context.strokeStyle = "#a3aaa5";
  context.lineWidth = 1;
  roundedRect(context, x - 52, y - 5, 104, 28, 3);
  context.fill();
  context.stroke();
  context.fillStyle = "#e8d39c";
  context.font = "800 11px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(activeEvent.target, x, y + 9);
  context.restore();
}
function drawScene(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: SceneState,
): void {
  const strength = Math.max(0.25, Math.min(1, state.effectsStrength));
  const baseTravel = state.playhead * 10;
  const fullTravel = state.playhead * (54 + state.energy * 0.48) * (state.driveActive ? 1.4 : 1);
  const travel = state.reducedMotion ? baseTravel : baseTravel + (fullTravel - baseTravel) * strength;
  const geometry = getCabGeometry(width, height, state);
  const palette = SCENE_PALETTES[state.stage.theme];
  drawPerspectiveBackdrop(context, width, height, travel, state, geometry, palette);
  drawPerspectiveTrack(context, width, height, travel, state, geometry, palette);
  drawRoadsideObjects(context, width, travel, state, geometry, palette);
  drawCabSpeed(context, width, height, state, geometry);
  if (!state.titleMode) {
    const visibleNotes = [...state.notes].sort((left, right) => right.time - left.time);
    for (const note of visibleNotes) drawPerspectiveNote(context, note, state, geometry, width);
    drawTargetGate(context, width, state, geometry);
    drawWorldRouteBoard(context, width, state, geometry);
  }
  if (state.driveActive) {
    const driveGlow = context.createRadialGradient(
      geometry.vanishX, geometry.horizonY, 3,
      geometry.vanishX, geometry.horizonY, width * 0.36,
    );
    driveGlow.addColorStop(0, state.stage.colors.highlight + "70");
    driveGlow.addColorStop(0.35, state.stage.colors.highlight + "1e");
    driveGlow.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = driveGlow;
    context.fillRect(0, 0, width, height);
  }
  drawCabFrame(context, width, height, state, geometry, palette);
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