import type { MobileAdapter } from "./mobile-adapter";
import type { MobileElement } from "./mobile.types";
import { keyboardBlocks } from "./phone-errors";

/**
 * Putting the iPhone keyboard away, and reaching a control it covers. iOS has no "hide keyboard" action of its own: the
 * keyboard goes when the app ends editing, which different apps do on different things (a Done key, a tap outside the
 * fields, a drag). So each way is tried and the one that worked is remembered by the recording.
 * All coordinates are points, which is what the page source, element rects and `mobile: tap` all use on iOS.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The ways an iPhone keyboard can be put away, in the order they are tried. */
export const HIDE_METHODS = ["driver", "doneKey", "tapOutside", "swipeDown"] as const;
export type HideMethod = (typeof HIDE_METHODS)[number];

const KEYBOARD = "-ios class chain:**/XCUIElementTypeKeyboard";
/** Only keys that end editing. Return, Go, Search, Send and Next can submit a form or move to another field. */
const DONE_KEY = `-ios class chain:**/XCUIElementTypeKeyboard/**/XCUIElementTypeButton[\`name IN {"Done","done","Hide keyboard","Dismiss"}\`]`;
/** A keyboard can animate away just after the gesture that dismissed it. */
const SETTLE_MS = 300;
const MIN_VISIBLE_PT = 12;
const MAX_SCROLLS = 3;
/** Controls a tap can land on. An accessible `Other` view is one too: React Native touchables become that. */
const TOUCHABLE =
  /^(Button|Cell|Link|TextField|SecureTextField|TextView|SearchField|Switch|Slider|Stepper|SegmentedControl|Picker|PickerWheel|Tab|TabBar|Key|Keyboard|Toolbar|Image)$/;

/** The keyboard's frame, or undefined when no keyboard is on screen. */
export async function keyboardRect(mobile: MobileAdapter): Promise<Rect | undefined> {
  const [keyboard] = await mobile.getDriver().$$(KEYBOARD);
  if (!keyboard || !(await keyboard.isDisplayed())) return undefined;
  return rectOf(keyboard);
}

export async function rectOf(element: MobileElement): Promise<Rect> {
  const [location, size] = await Promise.all([element.getLocation(), element.getSize()]);
  return { x: location.x, y: location.y, width: size.width, height: size.height };
}

function touchableRects(pageSource: string): Rect[] {
  const rects: Rect[] = [];
  const tag = /<(XCUIElementType\w+)((?:\s+[\w:-]+="[^"]*")*)\s*\/?>/g;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(pageSource))) {
    const type = match[1].replace(/^XCUIElementType/, "");
    const attrs: Record<string, string> = {};
    for (const a of match[2].matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
    if (!(TOUCHABLE.test(type) || (type === "Other" && attrs.accessible === "true"))) continue;
    const rect = { x: Number(attrs.x), y: Number(attrs.y), width: Number(attrs.width), height: Number(attrs.height) };
    if (Object.values(rect).every(Number.isFinite)) rects.push(rect);
  }
  return rects;
}

const inside = (rect: Rect, x: number, y: number) =>
  x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;

/**
 * A point above the keyboard that is on no control, so tapping it can do nothing but end editing. Undefined when every
 * candidate is on a control.
 */
export function neutralPoint(
  pageSource: string,
  keyboardTop: number,
  window: { width: number; height: number },
): { x: number; y: number } | undefined {
  const blocked = touchableRects(pageSource);
  const top = Math.max(60, Math.round(window.height * 0.12));
  for (let y = top; y <= keyboardTop - 16; y += 24) {
    for (const share of [0.5, 0.15, 0.85]) {
      const x = Math.round(window.width * share);
      if (!blocked.some((rect) => inside(rect, x, y))) return { x, y };
    }
  }
  return undefined;
}

async function keyboardGone(mobile: MobileAdapter): Promise<boolean> {
  const driver = mobile.getDriver();
  if (!(await driver.isKeyboardShown())) return true;
  await mobile.pause(SETTLE_MS);
  return !(await driver.isKeyboardShown());
}

/** Tries one way. Says whether the keyboard is gone afterwards; a way that does not work is false, not an error. */
export async function tryHide(mobile: MobileAdapter, method: HideMethod): Promise<boolean> {
  const driver = mobile.getDriver();
  if (method === "driver") {
    try {
      await driver.hideKeyboard();
    } catch (error: any) {
      // The driver says so when it finds no key to dismiss it with.
      if (!String(error?.message ?? error).includes("dismiss the keyboard")) throw error;
    }
    return keyboardGone(mobile);
  }
  if (method === "doneKey") {
    const key = (await driver.$$(DONE_KEY))[0];
    if (!key || !(await key.isDisplayed())) return false;
    await key.click();
    return keyboardGone(mobile);
  }
  const keyboard = await keyboardRect(mobile);
  // Without a frame there is nowhere to aim; what the phone says about its keyboard is then the only answer.
  if (!keyboard) return !(await driver.isKeyboardShown());
  const window = await driver.getWindowSize();
  const point = neutralPoint(await driver.getPageSource(), keyboard.y, window);
  if (!point) return false;
  if (method === "tapOutside") {
    await driver.execute("mobile: tap", { x: point.x, y: point.y });
  } else {
    await driver.execute("mobile: dragFromToForDuration", {
      fromX: point.x,
      fromY: keyboard.y - 16,
      toX: point.x,
      toY: window.height - 4,
      duration: 0.1,
    });
  }
  return keyboardGone(mobile);
}

/** Tries `methods` in order and returns the first that hid the keyboard, or undefined when none did. */
export async function hideKeyboardBy(
  mobile: MobileAdapter,
  methods: readonly HideMethod[] = HIDE_METHODS,
): Promise<HideMethod | undefined> {
  for (const method of methods) {
    if (await tryHide(mobile, method)) return method;
  }
  return undefined;
}

/** The recorded method first, then the others: an app update can change what works. */
export function methodsFrom(first?: HideMethod): HideMethod[] {
  return first ? [first, ...HIDE_METHODS.filter((m) => m !== first)] : [...HIDE_METHODS];
}

export type Reach = { kind: "direct" } | { kind: "point"; x: number; y: number };

/**
 * How to touch `element` when a keyboard may cover it: directly when it is clear of the keyboard, at the middle of its
 * visible part when the keyboard covers only some of it, otherwise after putting the keyboard away or scrolling the
 * element above it. Throws when none of that works.
 */
export async function reachTarget(mobile: MobileAdapter, element: MobileElement, label: string): Promise<Reach> {
  const keyboard = await keyboardRect(mobile);
  if (!keyboard) return { kind: "direct" };
  const classify = (r: Rect): Reach | undefined => {
    if (r.y + r.height <= keyboard.y) return { kind: "direct" };
    if (keyboard.y - r.y >= MIN_VISIBLE_PT) return { kind: "point", x: r.x + r.width / 2, y: r.y + (keyboard.y - r.y) / 2 };
    return undefined;
  };
  let rect = await rectOf(element);
  const reached = classify(rect);
  if (reached) return reached;

  // The Simulator reports a keyboard as shown even when it is not, so only a phone can tell whether hiding worked.
  if (mobile.phone && (await hideKeyboardBy(mobile))) return { kind: "direct" };

  const driver = mobile.getDriver();
  const window = await driver.getWindowSize();
  for (let attempt = 0; attempt < MAX_SCROLLS; attempt += 1) {
    const point = neutralPoint(await driver.getPageSource(), keyboard.y, window);
    if (!point) break;
    const distance = Math.min(rect.y + rect.height - keyboard.y + 24, keyboard.y - 80);
    await driver.execute("mobile: dragFromToForDuration", {
      fromX: point.x,
      fromY: keyboard.y - 16,
      toX: point.x,
      toY: keyboard.y - 16 - distance,
      duration: 0.1,
    });
    const moved = await rectOf(element);
    if (moved.y === rect.y) break;
    rect = moved;
    const now = classify(rect);
    if (now) return now;
  }
  throw new Error(keyboardBlocks(label));
}
