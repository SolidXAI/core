// Purpose: ${media:name} resolves a file in the run's media folder, refuses names that could leave it, and leaves ${env:TEST_UPLOADS_MEDIA_FILE_PATH} working.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { TestContext } from "../contracts/runtime-context.types";
import { interpolateDeep, interpolateString } from "./interpolation";
import { SimpleResourceStore } from "./resource-store";

function makeCtx(env?: Record<string, string>): TestContext {
  return {
    scenarioId: "spec",
    scenarioType: "api",
    params: {},
    env,
    resources: new SimpleResourceStore(),
    reporter: { onScenarioStart: () => {}, onStep: () => {}, onScenarioEnd: () => {} } as any,
  } as TestContext;
}

describe("${media:name}", () => {
  let folder: string;
  const savedEnv = process.env.TEST_UPLOADS_MEDIA_FILE_PATH;

  beforeEach(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), "media-token-spec-"));
    fs.writeFileSync(path.join(folder, "a.jpg"), "a");
    fs.mkdirSync(path.join(folder, "sub"));
    fs.writeFileSync(path.join(folder, "sub", "b.png"), "b");
    delete process.env.TEST_UPLOADS_MEDIA_FILE_PATH;
  });

  afterEach(() => {
    fs.rmSync(folder, { recursive: true, force: true });
    if (savedEnv === undefined) delete process.env.TEST_UPLOADS_MEDIA_FILE_PATH;
    else process.env.TEST_UPLOADS_MEDIA_FILE_PATH = savedEnv;
  });

  it("resolves a file name to its full path in the run's folder", () => {
    const ctx = makeCtx({ TEST_UPLOADS_MEDIA_FILE_PATH: folder });
    expect(interpolateString("${media:a.jpg}", ctx)).toBe(path.join(folder, "a.jpg"));
    expect(interpolateString("${media:sub/b.png}", ctx)).toBe(path.join(folder, "sub", "b.png"));
  });

  it("uses the process environment when the context has no value", () => {
    process.env.TEST_UPLOADS_MEDIA_FILE_PATH = folder;
    expect(interpolateString("${media:a.jpg}", makeCtx())).toBe(path.join(folder, "a.jpg"));
  });

  it("keeps a plain string inside a prefixed value, as in file:${media:...}", () => {
    const ctx = makeCtx({ TEST_UPLOADS_MEDIA_FILE_PATH: folder });
    expect(interpolateDeep({ value: "file:${media:a.jpg}" }, ctx)).toEqual({ value: `file:${path.join(folder, "a.jpg")}` });
  });

  it.each([
    ["an empty name", "${media:}"],
    ["an absolute path", "${media:/etc/passwd}"],
    ["a parent reference", "${media:../x}"],
    ["a parent reference in the middle", "${media:a/../../x}"],
    ["an empty segment", "${media:a//b}"],
    ["a backslash", "${media:a\\b.jpg}"],
  ])("refuses %s", (_label, input) => {
    const ctx = makeCtx({ TEST_UPLOADS_MEDIA_FILE_PATH: folder });
    expect(() => interpolateString(input, ctx)).toThrow();
  });

  it("refuses a file that is not in the folder", () => {
    const ctx = makeCtx({ TEST_UPLOADS_MEDIA_FILE_PATH: folder });
    expect(() => interpolateString("${media:missing.jpg}", ctx)).toThrow(/missing\.jpg.*was not found/);
  });

  it("refuses when no folder is set", () => {
    expect(() => interpolateString("${media:a.jpg}", makeCtx())).toThrow(/TEST_UPLOADS_MEDIA_FILE_PATH is not set/);
  });

  it("still resolves the old ${env:TEST_UPLOADS_MEDIA_FILE_PATH}/name form", () => {
    const ctx = makeCtx({ TEST_UPLOADS_MEDIA_FILE_PATH: folder });
    expect(interpolateString("${env:TEST_UPLOADS_MEDIA_FILE_PATH}/a.jpg", ctx)).toBe(`${folder}/a.jpg`);
  });
});
