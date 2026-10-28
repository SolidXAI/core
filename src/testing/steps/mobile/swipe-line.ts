export interface Area {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type SwipeDirection = "up" | "down" | "left" | "right";

/**
 * The finger's path for a swipe inside `area`: a line through its centre, `percent` of its height (up and down) or width
 * (left and right) long. The direction is where the finger moves, so "up" starts at the bottom, as on Android's
 * `mobile: swipeGesture`. iOS has no swipe-in-an-area command, so the path is dragged instead.
 */
export function swipeLine(area: Area, direction: SwipeDirection, percent: number) {
  const cx = area.left + area.width / 2;
  const cy = area.top + area.height / 2;
  const half = ((direction === "up" || direction === "down" ? area.height : area.width) * percent) / 2;
  const round = (n: number) => Math.round(n);
  switch (direction) {
    case "up":
      return { fromX: round(cx), fromY: round(cy + half), toX: round(cx), toY: round(cy - half) };
    case "down":
      return { fromX: round(cx), fromY: round(cy - half), toX: round(cx), toY: round(cy + half) };
    case "left":
      return { fromX: round(cx + half), fromY: round(cy), toX: round(cx - half), toY: round(cy) };
    case "right":
      return { fromX: round(cx - half), fromY: round(cy), toX: round(cx + half), toY: round(cy) };
  }
}
