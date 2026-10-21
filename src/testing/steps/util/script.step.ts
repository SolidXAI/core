// Purpose: util.script runs a short TypeScript function over the values passed in `input` and returns
// its result, so `saveAs` can keep a value no token can reach: an id found by a condition, two responses
// combined, a field reshaped for the next request. Tokens go in `input`; code goes in `script`.
// Anything with I/O, async work or reuse across scenarios belongs in a test.spec.

import * as vm from "vm";
import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { interpolateDeep } from "../../core/interpolation";
import { StepRegistry } from "../../core/step-registry";
import { findTokens } from "../../core/token-scan";

type ScriptInput = { script?: unknown; input?: unknown };

/** What the sandbox hands back, always as JSON text, so no object made in it reaches the runner. */
type SandboxOutcome = {
  kind: "value" | "undefined" | "error" | "promise" | "function" | "unsaveable";
  json?: string;
  name?: string;
  message?: string;
  logs: string[];
};

const DEFAULT_TIMEOUT_MS = 5_000;
// A script runs synchronously in the runner's process, so while it runs nothing else does: in test-hub,
// that is the whole API. A step may lower the limit but not raise it past this.
const MAX_TIMEOUT_MS = 30_000;
// One line before the script, so a diagnostic's 0-based line number is the script's own 1-based line.
const WRAP_START = "(function () {\n";
const WRAP_END = "\n})()";
// Vocabulary tokens are refused inside a script: there `${...}` is a JavaScript template literal.
const TOKEN_PREFIXES = ["res:", "env:", "params.", "data:", "data.", "secret:", "random:", "now:"];
const OUT_OF_SCOPE = /^(res|params|data|env|secrets?|lastResponse) is not defined$/;

// The sandbox is given only text. An object made outside it would carry the runner's own Function
// constructor (`input.constructor.constructor("return process")()`), and with it everything the
// process can do. So `input` arrives as JSON and is parsed in here, `console` is written in here, and
// the result is checked and turned into JSON in here, inside the timeout: a getter in the result
// cannot then run unbounded once the script has returned.
const PRELUDE = `var input = JSON.parse(__input);
var __logs = [];
var console = (function () {
  function text(value) {
    if (typeof value === "string") return value;
    try { var json = JSON.stringify(value); return json === undefined ? String(value) : json; } catch (e) { return String(value); }
  }
  function write(level) {
    return function () { __logs.push(level + ": " + Array.prototype.map.call(arguments, text).join(" ")); };
  }
  return { log: write("log"), info: write("info"), warn: write("warn"), error: write("error"), debug: write("debug") };
})();
var __result, __thrown, __failed = false;
try { __result = `;

const EPILOGUE = `; } catch (e) { __failed = true; __thrown = e; }
(function () {
  var out = { logs: __logs };
  if (__failed) {
    out.kind = "error";
    try {
      out.name = __thrown && __thrown.name ? String(__thrown.name) : "";
      out.message = __thrown && __thrown.message !== undefined ? String(__thrown.message) : String(__thrown);
    } catch (e) { out.message = "the script threw a value that cannot be read"; }
  } else if (__result !== null && (typeof __result === "object" || typeof __result === "function") && typeof __result.then === "function") {
    out.kind = "promise";
  } else if (typeof __result === "function") {
    out.kind = "function";
  } else if (__result === undefined) {
    out.kind = "undefined";
  } else {
    try {
      out.json = JSON.stringify(__result);
      out.kind = out.json === undefined ? "unsaveable" : "value";
    } catch (e) { out.kind = "unsaveable"; out.message = String(e && e.message); }
  }
  return JSON.stringify(out);
})()`;

type TypeScriptModule = typeof import("typescript");
let typescript: TypeScriptModule | null | undefined;

// typescript is a devDependency, so a production install may lack it. Plain JavaScript still runs then.
function loadTypeScript(): TypeScriptModule | null {
  if (typescript === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      typescript = require("typescript") as TypeScriptModule;
    } catch {
      typescript = null;
    }
  }
  return typescript;
}

// A script is text, or a list of lines: multi-line code in one JSON string is hard to read.
function scriptSource(script: unknown): string {
  if (typeof script === "string") return script;
  if (Array.isArray(script) && script.every((line) => typeof line === "string")) return script.join("\n");
  throw new Error('"script" must be text or a list of lines for op "util.script"');
}

function refuseTokens(source: string): void {
  for (const { inner } of findTokens(source)) {
    const token = inner.trim();
    if (TOKEN_PREFIXES.some((prefix) => token.startsWith(prefix))) {
      throw new Error(
        `util.script does not resolve \${${token}} inside the script; put tokens in "input" and read them as input.<name>`,
      );
    }
  }
}

// Compiles the script as one function call, then sets it between the sandbox's prelude and epilogue.
function compile(source: string): string {
  const wrapped = WRAP_START + source + WRAP_END;
  const ts = loadTypeScript();
  let call = wrapped;
  if (ts) {
    const out = ts.transpileModule(wrapped, {
      reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    });
    const first = out.diagnostics?.[0];
    if (first) {
      // A mistake such as an unclosed `{` is found on the wrapper's closing line; report the script's last line.
      const lines = source.split("\n").length;
      const where =
        first.file && first.start !== undefined
          ? ` (line ${Math.min(first.file.getLineAndCharacterOfPosition(first.start).line, lines)})`
          : "";
      throw new Error(`util.script does not compile${where}: ${ts.flattenDiagnosticMessageText(first.messageText, "\n")}`);
    }
    call = out.outputText.trim().replace(/;$/, "");
  }
  return PRELUDE + call + EPILOGUE;
}

function hintFor(name: string | undefined, message: string): string {
  if (OUT_OF_SCOPE.test(message)) {
    return '; the script sees only input, so pass the value in, e.g. "input": { "books": "${res:books}" }';
  }
  if (name === "SyntaxError" && /await/.test(message)) {
    return "; util.script runs synchronously, so await is not available";
  }
  if (name === "SyntaxError" && !loadTypeScript()) {
    return "; TypeScript syntax needs the typescript package where the tests run";
  }
  return "";
}

function timeoutFor(step: OpStep): number {
  const requested = step.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return Math.min(Math.max(1, Math.floor(requested)), MAX_TIMEOUT_MS);
}

function run(code: string, input: unknown, timeoutMs: number): SandboxOutcome {
  // No prototype: a plain object would give the script `this.constructor`, the runner's own Object.
  const sandbox = Object.assign(Object.create(null), { __input: JSON.stringify(input) });
  let text: unknown;
  try {
    text = vm.runInNewContext(code, sandbox, { filename: "util.script", timeout: timeoutMs });
  } catch (err: any) {
    if (err?.code === "ERR_SCRIPT_EXECUTION_TIMEOUT") {
      const most = timeoutMs === MAX_TIMEOUT_MS ? `, the most a script may run` : " (raise timeoutMs on the step if it needs longer)";
      throw new Error(`util.script ran past ${timeoutMs}ms${most}`);
    }
    // What reaches here failed to compile, so no script code ran: a syntax error such as `await`.
    const message = String(err?.message ?? err);
    throw new Error(`util.script failed: ${message}${hintFor(err?.name, message)}`);
  }
  try {
    return JSON.parse(String(text)) as SandboxOutcome;
  } catch {
    throw new Error("util.script did not finish normally; do not reassign JSON or the runner's names (__input, __logs)");
  }
}

// The script's console output goes to the step's report, where the author looks, not to the server log.
function attachLogs(ctx: TestContext, step: OpStep, logs: string[]): void {
  if (!logs?.length || !ctx.reporter?.attach) return;
  ctx.reporter.attach({
    scenarioId: ctx.scenarioId,
    name: step.name ? `util.script console: ${step.name}` : "util.script console",
    contentType: "text/plain",
    data: logs.join("\n"),
  });
}

function toSaved(outcome: SandboxOutcome): unknown {
  switch (outcome.kind) {
    case "value":
      return JSON.parse(outcome.json as string);
    case "undefined":
      return undefined;
    case "error": {
      const message = outcome.message ?? "";
      throw new Error(`util.script failed: ${message}${hintFor(outcome.name, message)}`);
    }
    case "promise":
      throw new Error("util.script returned a Promise; scripts run synchronously, so compute the value and return it");
    case "function":
      throw new Error("util.script must return data (text, numbers, true/false, lists or objects), not a function");
    default:
      throw new Error(
        `util.script must return data (text, numbers, true/false, lists or objects)${outcome.message ? `: ${outcome.message}` : ""}`,
      );
  }
}

export function registerScriptStep(registry: StepRegistry): void {
  registry.register(
    "util.script",
    async (ctx: TestContext, step: OpStep) => {
      const w = (step.with ?? {}) as ScriptInput;
      if (w.script === undefined) {
        throw new Error('Missing "script" in step.with for op "util.script"');
      }
      const source = scriptSource(w.script);
      if (!source.trim()) {
        throw new Error('Missing "script" in step.with for op "util.script"');
      }
      if (w.input !== undefined && (w.input === null || typeof w.input !== "object" || Array.isArray(w.input))) {
        throw new Error('"input" must be an object for op "util.script", e.g. { "books": "${res:books}" }');
      }
      refuseTokens(source);
      const code = compile(source);
      // The engine leaves `input` raw for this op; resolve it here with whole-value tokens keeping their type.
      // It crosses into the sandbox as JSON, which also makes it a copy: a script cannot change a saved result.
      const input = interpolateDeep((w.input ?? {}) as Record<string, unknown>, ctx, { keepTypes: true });
      const outcome = run(code, input, timeoutFor(step));
      attachLogs(ctx, step, outcome.logs);
      const result = toSaved(outcome);
      if (result === undefined && step.saveAs) {
        throw new Error(
          `util.script returned nothing to save as "${step.saveAs}"; end the script with return, e.g. return input.records[0].id`,
        );
      }
      return result;
    },
    { rawWith: ["script", "input"] },
  );
}
