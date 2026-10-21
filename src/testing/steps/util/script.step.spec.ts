// Purpose: util.script must turn saved values into a new one without touching the originals, keep
// whole-value tokens typed, leave its own `${...}` template literals alone, and fail with messages
// that say what to write instead.

import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { interpolateDeep } from "../../core/interpolation";
import { SimpleResourceStore } from "../../core/resource-store";
import { StepRegistry } from "../../core/step-registry";
import { TestingEngine } from "../../core/testing-engine";
import { registerUtilSteps } from ".";

function makeCtx(overrides: Partial<TestContext> = {}): TestContext {
  return {
    scenarioId: "spec",
    scenarioType: "api",
    params: {},
    resources: new SimpleResourceStore(),
    reporter: {} as any,
    ...overrides,
  } as TestContext;
}

const registry = new StepRegistry();
registerUtilSteps(registry);

const script = (ctx: TestContext, w: Record<string, any>, extra: Partial<OpStep> = {}) =>
  registry.get("util.script")(ctx, { op: "util.script", with: w, ...extra });

function ctxWithBooks(): TestContext {
  const ctx = makeCtx();
  ctx.resources.set("books", {
    bodyJson: {
      records: [
        { id: 1, title: "A" },
        { id: 2, title: "B" },
      ],
    },
  });
  return ctx;
}

describe("util.script: mapping saved values", () => {
  it("picks an id out of a saved response passed as input", async () => {
    const result = await script(ctxWithBooks(), {
      input: { records: "${res:books.bodyJson.records}", title: "B" },
      script: "return input.records.find((b: any) => b.title === input.title).id;",
    });
    expect(result).toBe(2);
  });

  it("keeps the type of a whole-value token, and stringifies an embedded one", async () => {
    const ctx = ctxWithBooks();
    ctx.resources.set("r", { status: 200 });
    const result = await script(ctx, {
      input: {
        records: "${res:books.bodyJson.records}",
        status: "${res:r.status}",
        label: "id-${res:r.status}",
      },
      script: "return { isList: Array.isArray(input.records), status: input.status, label: input.label };",
    });
    expect(result).toEqual({ isList: true, status: 200, label: "id-200" });
  });

  it("fails on a resource that was never saved", async () => {
    await expect(
      script(makeCtx(), { input: { x: "${res:nope.value}" }, script: "return input.x;" }),
    ).rejects.toThrow(/Missing resource for token/);
  });

  it("compiles TypeScript syntax", async () => {
    const result = await script(makeCtx(), {
      input: { n: 4 },
      script: [
        "interface Box { n: number }",
        "function twice<T extends Box>(b: T): number { return b.n * 2; }",
        "return twice(input as unknown as Box);",
      ],
    });
    expect(result).toBe(8);
  });

  it("takes the script as a list of lines", async () => {
    expect(await script(makeCtx(), { input: { x: 21 }, script: ["const a = input.x;", "return a * 2;"] })).toBe(42);
  });

  it("cannot change a saved result through input", async () => {
    const ctx = makeCtx();
    ctx.resources.set("list", [1, 2]);
    const length = await script(ctx, {
      input: { list: "${res:list}" },
      script: "input.list.push(9); return input.list.length;",
    });
    expect(length).toBe(3);
    expect(ctx.resources.get("list")).toEqual([1, 2]);
  });

  it("resolves random, secret and param tokens in input", async () => {
    const ctx = makeCtx({ params: { p: "x" }, secrets: { k: "v" } });
    const result: any = await script(ctx, {
      input: { email: "${random:emailAddress}", secret: "${secret:k}", p: "${params.p}" },
      script: "return input;",
    });
    expect(result.email).toMatch(/@example\.com$/);
    expect(result.secret).toBe("v");
    expect(result.p).toBe("x");
  });

  it("returns undefined without an error when nothing is saved, so it can act as a check", async () => {
    expect(await script(makeCtx(), { input: {}, script: "if (1 + 1 !== 2) throw new Error('no');" })).toBeUndefined();
  });
});

describe("util.script: through the engine", () => {
  it("leaves the script and input as written, then resolves them itself", async () => {
    const ended: any[] = [];
    const reporter = {
      onScenarioStart() {},
      onScenarioEnd() {},
      onStepStart() {},
      onStepEnd(a: any) {
        ended.push(a);
      },
    };
    const resources = new SimpleResourceStore();
    resources.set("r", { id: 7 });
    await new TestingEngine(registry).runScenario(
      {
        id: "s",
        type: "api",
        steps: [
          {
            op: "util.script",
            with: { input: { id: "${res:r.id}" }, script: "return `${input.id}-x`;" },
            saveAs: "out",
          },
        ],
      },
      { resources, reporter } as any,
    );
    expect(resources.get("out")).toBe("7-x");
    // The report shows input as written, so a secret passed in is not printed.
    expect(ended[0].step.with.input.id).toBe("${res:r.id}");
  });

  it("still stringifies a whole-value token for other callers", () => {
    const ctx = makeCtx();
    ctx.resources.set("r", { a: 1 });
    expect(interpolateDeep({ a: "${res:r}" }, ctx)).toEqual({ a: '{"a":1}' });
    expect(interpolateDeep({ a: "${res:r}" }, ctx, { keepTypes: true })).toEqual({ a: { a: 1 } });
  });
});

describe("util.script: the sandbox", () => {
  // Each of these reached the runner's `process` before the sandbox was given only text.
  it.each([
    ["the global object", "return this.constructor.constructor('return typeof process')();"],
    ["input", "return input.constructor.constructor('return typeof process')();"],
    ["a list in input", "return input.list.constructor.constructor('return typeof process')();"],
    ["console", "return console.log.constructor('return typeof process')();"],
    ["globalThis", "return typeof globalThis.process;"],
  ])("does not reach the runner's process through %s", async (_label, body) => {
    expect(await script(makeCtx(), { input: { list: [1] }, script: body })).toBe("undefined");
  });

  it("cannot require modules", async () => {
    await expect(script(makeCtx(), { script: "return require('fs');" })).rejects.toThrow(/require is not defined/);
  });

  it("stops a getter in the result that never ends", async () => {
    await expect(
      script(makeCtx(), { script: "return { get x() { while (true) {} } };" }, { timeoutMs: 50 }),
    ).rejects.toThrow(/ran past 50ms/);
  });

  it("caps timeoutMs instead of failing on a large value", async () => {
    expect(await script(makeCtx(), { script: "return 1;" }, { timeoutMs: 10_000_000 })).toBe(1);
  });

  it("returns a date as text, since results are data", async () => {
    expect(await script(makeCtx(), { script: "return new Date(Date.UTC(2026, 9, 19));" })).toBe(
      "2026-10-19T00:00:00.000Z",
    );
  });

  it("refuses a result that cannot be saved", async () => {
    await expect(script(makeCtx(), { script: "const a: any = {}; a.self = a; return a;" })).rejects.toThrow(
      /must return data.*circular/i,
    );
  });

  it("attaches console output to the step report, also when the script throws", async () => {
    const attached: any[] = [];
    const ctx = makeCtx({ reporter: { attach: (a: any) => attached.push(a) } as any });
    await script(ctx, { script: "console.log('picked', { id: 2 }); console.warn('slow'); return 2;" }, { name: "pick" });
    await expect(script(ctx, { script: "console.error('about to fail'); throw new Error('boom');" })).rejects.toThrow(
      /boom/,
    );
    expect(attached.map((a) => [a.name, a.data])).toEqual([
      ["util.script console: pick", 'log: picked {"id":2}\nwarn: slow'],
      ["util.script console", "error: about to fail"],
    ]);
  });
});

describe("util.script: refusals", () => {
  it("refuses a vocabulary token inside the script", async () => {
    await expect(script(makeCtx(), { script: "return '${res:x}';" })).rejects.toThrow(/put tokens in "input"/);
  });

  it("says the script sees only input when it reads res", async () => {
    await expect(script(makeCtx(), { script: "return res.x;" })).rejects.toThrow(/sees only input/);
  });

  it("refuses a missing return when the result is saved", async () => {
    await expect(script(makeCtx(), { script: "const a = 1;" }, { saveAs: "x" })).rejects.toThrow(
      /returned nothing to save as "x"/,
    );
  });

  it("refuses a Promise", async () => {
    await expect(script(makeCtx(), { script: "return Promise.resolve(1);" })).rejects.toThrow(/returned a Promise/);
  });

  it("refuses a function", async () => {
    await expect(script(makeCtx(), { script: "return () => 1;" })).rejects.toThrow(/must return data/);
  });

  it("says await is not available", async () => {
    await expect(script(makeCtx(), { script: "const a = await 1; return a;" })).rejects.toThrow(
      /await is not available/,
    );
  });

  it("reports the line of a syntax error", async () => {
    await expect(script(makeCtx(), { script: "const a = 1;\nconst x = ;" })).rejects.toThrow(
      /does not compile \(line 2\)/,
    );
  });

  it("reports an unclosed block on the script's last line", async () => {
    await expect(script(makeCtx(), { script: "const a = 1;\nif (a) {" })).rejects.toThrow(/does not compile \(line 2\)/);
  });

  it("stops a script that never ends", async () => {
    await expect(script(makeCtx(), { script: "while (true) {}" }, { timeoutMs: 50 })).rejects.toThrow(
      /ran past 50ms/,
    );
  });

  it("needs a script", async () => {
    await expect(script(makeCtx(), {})).rejects.toThrow(/Missing "script"/);
    await expect(script(makeCtx(), { script: "" })).rejects.toThrow(/Missing "script"/);
    await expect(script(makeCtx(), { script: "  " })).rejects.toThrow(/Missing "script"/);
  });

  it("needs input to be an object", async () => {
    await expect(script(makeCtx(), { script: "return 1;", input: [1] })).rejects.toThrow(
      /"input" must be an object/,
    );
  });

  it("reports what the script threw", async () => {
    await expect(script(makeCtx(), { script: "throw new Error('boom');" })).rejects.toThrow(
      /util\.script failed: boom/,
    );
  });
});
