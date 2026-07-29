import assert from "node:assert/strict";
import test from "node:test";
import {
  observeMediaQuery,
  pointerEventsAvailable,
  traceRoundedRect,
  type MediaQueryListCompat,
} from "../src/game/browserCompatibility.ts";

test("media query observer uses the modern change listener and cleans it up", () => {
  let listener: (() => void) | undefined;
  let removed: (() => void) | undefined;
  const query: MediaQueryListCompat = {
    matches: true,
    addEventListener(type, next) {
      assert.equal(type, "change");
      listener = next;
    },
    removeEventListener(type, next) {
      assert.equal(type, "change");
      removed = next;
    },
  };
  const values: boolean[] = [];

  const cleanup = observeMediaQuery("reduce", (value) => values.push(value), () => query);
  listener?.();
  cleanup();

  assert.deepEqual(values, [true, true]);
  assert.equal(removed, listener);
});

test("media query observer supports legacy iPad Safari listeners", () => {
  let listener: (() => void) | undefined;
  let removed: (() => void) | undefined;
  const query: MediaQueryListCompat = {
    matches: false,
    addListener(next) {
      listener = next;
    },
    removeListener(next) {
      removed = next;
    },
  };
  const values: boolean[] = [];

  const cleanup = observeMediaQuery("reduce", (value) => values.push(value), () => query);
  listener?.();
  cleanup();

  assert.deepEqual(values, [false, false]);
  assert.equal(removed, listener);
});

test("a throwing modern listener falls back to the legacy Safari API", () => {
  let legacyListener: (() => void) | undefined;
  let legacyRemoved: (() => void) | undefined;
  let modernCleanupAttempts = 0;
  const query: MediaQueryListCompat = {
    matches: true,
    addEventListener() {
      throw new Error("unsupported change listener");
    },
    removeEventListener() {
      modernCleanupAttempts += 1;
    },
    addListener(next) {
      legacyListener = next;
    },
    removeListener(next) {
      legacyRemoved = next;
    },
  };
  const values: boolean[] = [];

  const cleanup = observeMediaQuery("reduce", (value) => values.push(value), () => query);
  legacyListener?.();
  cleanup();

  assert.deepEqual(values, [true, true]);
  assert.equal(modernCleanupAttempts, 1);
  assert.equal(legacyRemoved, legacyListener);
});

test("missing listener APIs still provide the initial preference without throwing", () => {
  const values: boolean[] = [];
  const cleanup = observeMediaQuery(
    "reduce",
    (value) => values.push(value),
    () => ({ matches: true }),
  );

  assert.doesNotThrow(cleanup);
  assert.deepEqual(values, [true]);
});

test("missing or throwing matchMedia safely falls back to no reduced motion", () => {
  const missingValues: boolean[] = [];
  const throwingValues: boolean[] = [];

  const missingCleanup = observeMediaQuery(
    "reduce",
    (value) => missingValues.push(value),
    undefined,
  );
  const throwingCleanup = observeMediaQuery(
    "reduce",
    (value) => throwingValues.push(value),
    () => {
      throw new Error("matchMedia unavailable");
    },
  );

  assert.doesNotThrow(missingCleanup);
  assert.doesNotThrow(throwingCleanup);
  assert.deepEqual(missingValues, [false]);
  assert.deepEqual(throwingValues, [false]);
});

test("pointer event feature detection enables the legacy iPad touch fallback", () => {
  assert.equal(pointerEventsAvailable({}), false);
  assert.equal(pointerEventsAvailable({ PointerEvent: class PointerEvent {} }), true);
  assert.equal(pointerEventsAvailable({ PointerEvent: {} }), false);
});

test("rounded rectangle uses the native Canvas path when available", () => {
  const calls: Array<[string, ...number[]]> = [];
  const context = {
    beginPath() {
      calls.push(["beginPath"]);
    },
    roundRect(...values: number[]) {
      calls.push(["roundRect", ...values]);
    },
  } as unknown as CanvasRenderingContext2D;

  traceRoundedRect(context, 10, 20, 100, 60, 12);

  assert.deepEqual(calls, [
    ["beginPath"],
    ["roundRect", 10, 20, 100, 60, 12],
  ]);
});

test("rounded rectangle falls back to quadratic curves on legacy Safari", () => {
  const calls: Array<[string, ...number[]]> = [];
  const context = {
    beginPath() {
      calls.push(["beginPath"]);
    },
    moveTo(...values: number[]) {
      calls.push(["moveTo", ...values]);
    },
    lineTo(...values: number[]) {
      calls.push(["lineTo", ...values]);
    },
    quadraticCurveTo(...values: number[]) {
      calls.push(["quadraticCurveTo", ...values]);
    },
    closePath() {
      calls.push(["closePath"]);
    },
  } as unknown as CanvasRenderingContext2D;

  traceRoundedRect(context, 10, 20, 100, 60, 12);

  assert.deepEqual(calls, [
    ["beginPath"],
    ["moveTo", 22, 20],
    ["lineTo", 98, 20],
    ["quadraticCurveTo", 110, 20, 110, 32],
    ["lineTo", 110, 68],
    ["quadraticCurveTo", 110, 80, 98, 80],
    ["lineTo", 22, 80],
    ["quadraticCurveTo", 10, 80, 10, 68],
    ["lineTo", 10, 32],
    ["quadraticCurveTo", 10, 20, 22, 20],
    ["closePath"],
  ]);
});

test("rounded rectangle falls back when Safari exposes but rejects roundRect", () => {
  const calls: Array<[string, ...number[]]> = [];
  const context = {
    beginPath() {
      calls.push(["beginPath"]);
    },
    roundRect(...values: number[]) {
      calls.push(["roundRect", ...values]);
      throw new Error("roundRect is not implemented");
    },
    moveTo(...values: number[]) {
      calls.push(["moveTo", ...values]);
    },
    lineTo(...values: number[]) {
      calls.push(["lineTo", ...values]);
    },
    quadraticCurveTo(...values: number[]) {
      calls.push(["quadraticCurveTo", ...values]);
    },
    closePath() {
      calls.push(["closePath"]);
    },
  } as unknown as CanvasRenderingContext2D;

  traceRoundedRect(context, 10, 20, 100, 60, 12);

  assert.deepEqual(calls.slice(0, 4), [
    ["beginPath"],
    ["roundRect", 10, 20, 100, 60, 12],
    ["beginPath"],
    ["moveTo", 22, 20],
  ]);
  assert.deepEqual(calls[calls.length - 1], ["closePath"]);
});
