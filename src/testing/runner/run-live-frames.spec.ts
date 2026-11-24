import { getRunFrameSink, registerRunFrameSink, releaseRunFrameSink, RunFrameSink } from "./run-live-frames";

describe("run live frame registry", () => {
  const sink: RunFrameSink = { hasViewers: () => false, onViewersChanged: () => () => {}, push: () => {} };

  it("registers, gets and releases a sink by run id", () => {
    expect(getRunFrameSink("r1")).toBeUndefined();
    registerRunFrameSink("r1", sink);
    expect(getRunFrameSink("r1")).toBe(sink);
    expect(getRunFrameSink("r2")).toBeUndefined();
    releaseRunFrameSink("r1");
    expect(getRunFrameSink("r1")).toBeUndefined();
  });

  it("releasing an unknown run is harmless", () => {
    expect(() => releaseRunFrameSink("nope")).not.toThrow();
  });
});
