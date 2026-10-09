import type { MobileAdapter } from "../../adapters/mobile/mobile-adapter";
import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { StepRegistry } from "../../core/step-registry";
import { requireLocator, requireMobile, stepTimeout } from "./shared";

const DIRECTIONS = ["up", "down", "left", "right"] as const;
type Direction = (typeof DIRECTIONS)[number];

const DEFAULT_SWIPE_PERCENT = 0.75;
const DEFAULT_MAX_SWIPES = 10;
/** Whole-screen swipes stay clear of the status and navigation bars. */
const SCREEN_MARGIN = 0.1;

function readDirection(value: unknown, op: string, fallback?: Direction): Direction {
  const direction = value ?? fallback;
  if (typeof direction !== "string" || !DIRECTIONS.includes(direction as Direction)) {
    throw new Error(`"direction" must be one of ${DIRECTIONS.join(", ")} for op "${op}"`);
  }
  return direction as Direction;
}

function readPercent(value: unknown, op: string): number {
  if (value === undefined) return DEFAULT_SWIPE_PERCENT;
  if (typeof value !== "number" || !(value >= 0.1 && value <= 1)) {
    throw new Error(`"percent" must be a number from 0.1 to 1 for op "${op}"`);
  }
  return value;
}

/** Swipes inside an element, or across the screen when there is no area. */
async function swipe(
  mobile: MobileAdapter,
  direction: Direction,
  percent: number,
  area?: { left: number; top: number; width: number; height: number },
): Promise<void> {
  const driver = mobile.getDriver();
  let bounds = area;
  if (!bounds) {
    const screen = await driver.getWindowSize();
    bounds = {
      left: Math.round(screen.width * SCREEN_MARGIN),
      top: Math.round(screen.height * SCREEN_MARGIN),
      width: Math.round(screen.width * (1 - 2 * SCREEN_MARGIN)),
      height: Math.round(screen.height * (1 - 2 * SCREEN_MARGIN)),
    };
  }
  await driver.execute("mobile: swipeGesture", { ...bounds, direction, percent });
}

function isNotFound(error: unknown): boolean {
  const message = String((error as Error)?.message ?? error);
  return message.includes("No element matches") || message.includes("is not displayed after");
}

export function registerGestureSteps(registry: StepRegistry): void {
  registry.register("mobile.swipe", async (ctx: TestContext, step: OpStep) => {
    const mobile = requireMobile(ctx, "mobile.swipe");
    const direction = readDirection(step.with?.direction, "mobile.swipe");
    const percent = readPercent(step.with?.percent, "mobile.swipe");
    if (step.with?.locator === undefined) {
      await swipe(mobile, direction, percent);
      return;
    }
    const element = await mobile.findDisplayed(step.with.locator, stepTimeout(step));
    const [location, size] = await Promise.all([element.getLocation(), element.getSize()]);
    await swipe(mobile, direction, percent, { left: location.x, top: location.y, width: size.width, height: size.height });
  });

  registry.register("mobile.scrollTo", async (ctx: TestContext, step: OpStep) => {
    const mobile = requireMobile(ctx, "mobile.scrollTo");
    const locator = requireLocator(step, "mobile.scrollTo");
    const direction = readDirection(step.with?.direction, "mobile.scrollTo", "down");
    if (direction !== "down" && direction !== "up") {
      throw new Error('"direction" must be down or up for op "mobile.scrollTo"');
    }
    const maxSwipes = step.with?.maxSwipes ?? DEFAULT_MAX_SWIPES;
    if (typeof maxSwipes !== "number" || !Number.isInteger(maxSwipes) || maxSwipes < 1) {
      throw new Error('"maxSwipes" must be a whole number >= 1 for op "mobile.scrollTo"');
    }
    // To scroll down, the finger swipes up.
    const swipeDirection: Direction = direction === "down" ? "up" : "down";

    for (let attempt = 0; attempt <= maxSwipes; attempt += 1) {
      try {
        // A short wait per attempt: the element is either on screen already or it is not.
        await mobile.findDisplayed(locator, 1000);
        return;
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
      if (attempt < maxSwipes) {
        await swipe(mobile, swipeDirection, DEFAULT_SWIPE_PERCENT);
      }
    }
    throw new Error(`${mobile.describeLocator(locator)} not found after ${maxSwipes} swipes`);
  });
}
