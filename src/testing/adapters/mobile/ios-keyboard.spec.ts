import { neutralPoint } from "./ios-keyboard";

const WINDOW = { width: 400, height: 800 };
const control = (type: string, x: number, y: number, w: number, h: number, extra = "") =>
  `<XCUIElementType${type} ${extra} x="${x}" y="${y}" width="${w}" height="${h}"/>`;

describe("neutralPoint", () => {
  it("returns a point above the keyboard that is on no control", () => {
    const source = [
      control("Button", 0, 50, 100, 40, 'name="Back"'),
      control("TextField", 20, 200, 360, 40),
      control("Button", 20, 440, 360, 60),
    ].join("\n");
    const point = neutralPoint(source, 500, WINDOW)!;
    expect(point).toBeDefined();
    expect(point.y).toBeLessThanOrEqual(500 - 16);
    for (const [x, y, w, h] of [[0, 50, 100, 40], [20, 200, 360, 40], [20, 440, 360, 60]]) {
      expect(point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h).toBe(false);
    }
  });

  it("reads attributes in any order", () => {
    const source = '<XCUIElementTypeButton width="400" height="800" y="0" x="0" name="Everything"/>';
    expect(neutralPoint(source, 500, WINDOW)).toBeUndefined();
  });

  it("treats an accessible view as a control, and a plain one as free", () => {
    const touchable = control("Other", 0, 0, 400, 800, 'accessible="true"');
    expect(neutralPoint(touchable, 500, WINDOW)).toBeUndefined();
    expect(neutralPoint(control("Other", 0, 0, 400, 800, 'accessible="false"'), 500, WINDOW)).toBeDefined();
  });

  it("is undefined when every control covers the area", () => {
    expect(neutralPoint(control("Cell", 0, 0, 400, 800), 500, WINDOW)).toBeUndefined();
  });

  it("stays below the status bar", () => {
    expect(neutralPoint("", 500, WINDOW)!.y).toBeGreaterThanOrEqual(60);
  });
});
