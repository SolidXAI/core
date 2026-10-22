import { swipeLine } from "./swipe-line";

const area = { left: 100, top: 200, width: 400, height: 800 }; // centre (300, 600)

describe("swipeLine", () => {
  it("up: the finger moves from the bottom to the top", () => {
    expect(swipeLine(area, "up", 0.5)).toEqual({ fromX: 300, fromY: 800, toX: 300, toY: 400 });
  });

  it("down: the finger moves from the top to the bottom", () => {
    expect(swipeLine(area, "down", 0.5)).toEqual({ fromX: 300, fromY: 400, toX: 300, toY: 800 });
  });

  it("left and right use the width", () => {
    expect(swipeLine(area, "left", 0.5)).toEqual({ fromX: 400, fromY: 600, toX: 200, toY: 600 });
    expect(swipeLine(area, "right", 0.5)).toEqual({ fromX: 200, fromY: 600, toX: 400, toY: 600 });
  });

  it("percent 1 covers the whole area", () => {
    expect(swipeLine(area, "up", 1)).toEqual({ fromX: 300, fromY: 1000, toX: 300, toY: 200 });
  });

  it("rounds to whole points", () => {
    const line = swipeLine({ left: 0, top: 0, width: 101, height: 301 }, "up", 0.75);
    for (const value of Object.values(line)) expect(Number.isInteger(value)).toBe(true);
  });
});
