// Purpose: Basic console reporter implementation.

import type { Reporter } from "./reporter.types";
import type { OpStep } from "../contracts/testing-metadata.types";

const INDENT = "  ";
const STEP_INDENT = INDENT;
const MAX_DETAIL_LEN = 140;

function formatError(err: unknown): string {
  if (!err) return "";
  if (err instanceof Error) {
    return err.stack || err.message;
  }
  return String(err);
}

function indentLines(text: string, indent: string): string {
  return text
    .split("\n")
    .map((line) => (line.length ? `${indent}${line}` : indent))
    .join("\n");
}

function truncate(value: string, maxLen: number = MAX_DETAIL_LEN): string {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen - 1)}…`;
}

function formatHttpBody(body: unknown): string {
  if (body === null || body === undefined) return "";
  if (typeof body === "string") {
    const trimmed = body.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
      } catch {
        return body;
      }
    }
    return body;
  }
  try {
    return JSON.stringify(body, null, 2);
  } catch {
    return String(body);
  }
}

function withoutQuery(url: string): string {
  const idx = url.indexOf("?");
  return idx === -1 ? url : url.slice(0, idx);
}

function maskIfSensitive(value: string, hints: string[]): string {
  const lower = hints.join(" ").toLowerCase();
  if (lower.includes("password") || lower.includes("pwd")) {
    return "••••••";
  }
  return value;
}

function stepDetails(step: OpStep): string | undefined {
  const withObj = (step.with ?? {}) as Record<string, any>;

  switch (step.op) {
    case "api.request": {
      const method = String(withObj.method ?? "").toUpperCase();
      const url = typeof withObj.url === "string" ? withoutQuery(withObj.url) : "";
      if (!method && !url) return undefined;
      return `${method} ${url}`.trim();
    }
    case "api.auth.bearerFromLogin": {
      const url = typeof withObj.url === "string" ? withoutQuery(withObj.url) : "";
      return url ? `url: ${url}` : undefined;
    }
    case "ui.goto": {
      return withObj.url ? `url: ${withObj.url}` : undefined;
    }
    case "ui.click":
    case "ui.expectVisible": {
      return withObj.selector ? `selector: ${withObj.selector}` : undefined;
    }
    case "ui.fill":
    case "ui.select": {
      const selector = withObj.selector ? `selector: ${withObj.selector}` : "";
      const value =
        withObj.value !== undefined
          ? `value: ${maskIfSensitive(String(withObj.value), [String(withObj.selector ?? ""), String(step.op)])}`
          : "";
      return [selector, value].filter(Boolean).join(", ") || undefined;
    }
    case "ui.press": {
      const selector = withObj.selector ? `selector: ${withObj.selector}` : "";
      const key = withObj.key ? `key: ${withObj.key}` : "";
      return [selector, key].filter(Boolean).join(", ") || undefined;
    }
    case "ui.expectUrl": {
      const equals = withObj.equals ? `equals: ${withObj.equals}` : "";
      const contains = withObj.contains ? `contains: ${withObj.contains}` : "";
      return [equals, contains].filter(Boolean).join(", ") || undefined;
    }
    case "ui.expectText": {
      const selector = withObj.selector ? `selector: ${withObj.selector}` : "";
      const equals = withObj.equals ? `equals: ${truncate(String(withObj.equals))}` : "";
      const contains = withObj.contains ? `contains: ${truncate(String(withObj.contains))}` : "";
      return [selector, equals, contains].filter(Boolean).join(", ") || undefined;
    }
    case "assert.httpStatus": {
      return withObj.is !== undefined ? `status: ${withObj.is}` : undefined;
    }
    case "assert.jsonPath": {
      const path = withObj.path ? `path: ${withObj.path}` : "";
      const equals = withObj.equals !== undefined ? `equals: ${truncate(String(withObj.equals))}` : "";
      return [path, equals].filter(Boolean).join(", ") || undefined;
    }
    case "assert.contains":
    case "assert.equals":
    case "assert.matches": {
      const expected =
        withObj.expected !== undefined
          ? `expected: ${truncate(String(withObj.expected))}`
          : withObj.pattern
            ? `pattern: ${truncate(String(withObj.pattern))}`
            : withObj.equals !== undefined
              ? `equals: ${truncate(String(withObj.equals))}`
              : "";
      return expected || undefined;
    }
    case "util.sleep": {
      return withObj.ms !== undefined ? `ms: ${withObj.ms}` : undefined;
    }
    case "util.log": {
      return withObj.message ? `message: ${truncate(String(withObj.message))}` : undefined;
    }
    default:
      return undefined;
  }
}

function formatStepLabel(step: OpStep): string {
  const base = step.name ? `${step.op} (${step.name})` : step.op;
  const details = stepDetails(step);
  if (!details) return base;
  return `${base} (${details})`;
}

export class ConsoleReporter implements Reporter {
  onScenarioStart(scenario: { id: string; name?: string }): void {
    const label = scenario.name ? `${scenario.id} (${scenario.name})` : scenario.id;
    console.log(`\n▶ Scenario: ${label}`);
  }

  onScenarioEnd(
    scenario: { id: string; name?: string },
    result: { ok: boolean; error?: unknown; durationMs: number },
  ): void {
    const label = scenario.name ? `${scenario.id} (${scenario.name})` : scenario.id;
    const status = result.ok ? "✔" : "✖";
    console.log(`${status} Scenario: ${label} (${result.durationMs}ms)`);
  }

  onStepStart(args: {
    scenarioId: string;
    phase: string;
    step: OpStep;
  }): void {
    const label = formatStepLabel(args.step);
    const phase = args.phase.toUpperCase();
    console.log(`${STEP_INDENT}↳ ${phase} ${label}`);
  }

  onStepEnd(args: {
    scenarioId: string;
    phase: string;
    step: OpStep;
    ok: boolean;
    error?: unknown;
    durationMs: number;
  }): void {
    const label = formatStepLabel(args.step);
    const phase = args.phase.toUpperCase();
    const status = args.ok ? "✔" : "✖";
    console.log(
      `${STEP_INDENT}${status} ${phase} ${label} (${args.durationMs}ms)`
    );
    if (!args.ok && args.error) {
      const details = formatError(args.error);
      console.error(indentLines(details, `${STEP_INDENT}${INDENT}`));
      const httpBody = (args.error as any)?.httpResponseBody;
      if (httpBody !== undefined) {
        const formatted = formatHttpBody(httpBody);
        const bodyText = formatted.length ? formatted : "<empty>";
        console.error(
          indentLines(
            `HTTP Response Body:\n${bodyText}`,
            `${STEP_INDENT}${INDENT}`,
          ),
        );
      }
    }
  }

  onSpecResult(args: {
    scenarioId: string;
    specId: string;
    stepName?: string;
    result: { ok: boolean; details?: Record<string, any> };
  }): void {
    console.log(`${INDENT}↳ SPEC ${args.specId} ok=${args.result.ok}`);
    if (args.result.details) {
      const details = JSON.stringify(args.result.details, null, 2);
      console.log(indentLines(details, `${INDENT}${INDENT}`));
    }
  }
}
