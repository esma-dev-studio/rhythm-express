export interface PointerEventWindowCompat {
  PointerEvent?: unknown;
}

type MediaQueryChangeHandler = () => void;

export interface MediaQueryListCompat {
  readonly matches: boolean;
  addEventListener?: (type: "change", listener: MediaQueryChangeHandler) => void;
  removeEventListener?: (type: "change", listener: MediaQueryChangeHandler) => void;
  addListener?: (listener: MediaQueryChangeHandler) => void;
  removeListener?: (listener: MediaQueryChangeHandler) => void;
}

export type MatchMediaCompat = (query: string) => MediaQueryListCompat;

function noop(): void {
  // A stable cleanup keeps React effects simple when an optional browser API is absent.
}

function browserMatchMedia(): MatchMediaCompat | undefined {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
  return window.matchMedia.bind(window) as MatchMediaCompat;
}

/**
 * Pointer Events arrived later on iPad Safari than Touch Events. Keeping this
 * feature check in one place lets controls use a touch fallback without
 * double-firing on modern browsers that emit both event families.
 */
export function pointerEventsAvailable(
  browserWindow: PointerEventWindowCompat | undefined =
    typeof window === "undefined" ? undefined : window,
): boolean {
  return typeof browserWindow?.PointerEvent === "function";
}

function readMatches(query: MediaQueryListCompat): boolean {
  try {
    return Boolean(query.matches);
  } catch {
    return false;
  }
}

/**
 * Observes a media query across modern and legacy Safari without allowing an
 * optional preference API to stop the game initialization effects that follow.
 */
export function observeMediaQuery(
  queryText: string,
  onChange: (matches: boolean) => void,
  matchMedia: MatchMediaCompat | undefined = browserMatchMedia(),
): () => void {
  if (!matchMedia) {
    onChange(false);
    return noop;
  }

  let query: MediaQueryListCompat;
  try {
    query = matchMedia(queryText);
  } catch {
    onChange(false);
    return noop;
  }

  const notify = () => onChange(readMatches(query));
  notify();

  if (typeof query.addEventListener === "function") {
    try {
      query.addEventListener("change", notify);
      return () => {
        try {
          query.removeEventListener?.("change", notify);
        } catch {
          // Safari may invalidate a MediaQueryList while the page is unloading.
        }
      };
    } catch {
      try {
        query.removeEventListener?.("change", notify);
      } catch {
        // Fall through to Safari's legacy listener API.
      }
    }
  }

  if (typeof query.addListener === "function") {
    try {
      query.addListener(notify);
      return () => {
        try {
          query.removeListener?.(notify);
        } catch {
          // Cleanup must never make a React unmount fail.
        }
      };
    } catch {
      return noop;
    }
  }

  return noop;
}

/**
 * Adds a rounded rectangle path, using the pre-roundRect Canvas primitives
 * available on older iPad Safari releases when necessary.
 */
export function traceRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();

  if (typeof context.roundRect === "function") {
    try {
      context.roundRect(x, y, width, height, safeRadius);
      return;
    } catch {
      context.beginPath();
    }
  }

  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}
