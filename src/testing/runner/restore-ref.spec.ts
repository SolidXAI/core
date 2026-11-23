import { parseRestoreFrom } from "./restore-ref";

const MALFORMED = { error: "restoreFrom must be a setup id or { setup, fresh }" };

describe("parseRestoreFrom", () => {
  it("returns undefined when restoreFrom is absent", () => {
    expect(parseRestoreFrom(undefined)).toBeUndefined();
  });

  it("reads a non-empty string as a setup id that is not fresh", () => {
    expect(parseRestoreFrom("auth-default")).toEqual({ setupId: "auth-default", fresh: false });
  });

  it("reads { setup, fresh: true } as a fresh setup", () => {
    expect(parseRestoreFrom({ setup: "auth-default", fresh: true })).toEqual({ setupId: "auth-default", fresh: true });
  });

  it("reads { setup } without fresh as not fresh", () => {
    expect(parseRestoreFrom({ setup: "auth-default" })).toEqual({ setupId: "auth-default", fresh: false });
  });

  it("treats a non-boolean fresh as malformed", () => {
    expect(parseRestoreFrom({ setup: "auth-default", fresh: "yes" })).toEqual(MALFORMED);
  });

  it("rejects an empty string", () => {
    expect(parseRestoreFrom("")).toEqual(MALFORMED);
  });

  it("rejects a whitespace-only string", () => {
    expect(parseRestoreFrom("   ")).toEqual(MALFORMED);
  });

  it("rejects an object without a setup id", () => {
    expect(parseRestoreFrom({ fresh: true })).toEqual(MALFORMED);
  });

  it("rejects an object with an empty setup id", () => {
    expect(parseRestoreFrom({ setup: "", fresh: true })).toEqual(MALFORMED);
  });

  it("rejects an object with a whitespace-only setup id", () => {
    expect(parseRestoreFrom({ setup: " \t ", fresh: true })).toEqual(MALFORMED);
  });

  it("rejects null, numbers, booleans and arrays", () => {
    expect(parseRestoreFrom(null)).toEqual(MALFORMED);
    expect(parseRestoreFrom(42)).toEqual(MALFORMED);
    expect(parseRestoreFrom(true)).toEqual(MALFORMED);
    expect(parseRestoreFrom(["auth-default"])).toEqual(MALFORMED);
  });
});
