import * as readline from "readline";
import type { StepPhase } from "../contracts/runtime-context.types";
import type { OpStep, ScenarioSpec } from "../contracts/testing-metadata.types";
import type { SolidTestSpecResult } from "../contracts/test-spec.types";
import type { Reporter } from "./reporter.types";

const ANSI_BOLD = "\u001b[1m";
const ANSI_BOLD_OFF = "\u001b[22m";
const ANSI_DIM = "\u001b[2m";
const ANSI_GREEN = "\u001b[32m";
const ANSI_COLOR_OFF = "\u001b[39m";
const ANSI_RED = "\u001b[31m";
const ANSI_INVERSE = "\u001b[7m";
const ANSI_INVERSE_OFF = "\u001b[27m";

export class ProgressReporter implements Reporter {
  private startedAt = Date.now();
  private total = 0;
  private completed = 0;
  private passed = 0;
  private failed = 0;
  private timer?: NodeJS.Timeout;
  private rendered = false;

  constructor(private readonly delegate: Reporter) {}

  onRunStart(args: { total: number }): void {
    this.total = args.total;
    this.startedAt = Date.now();
    this.completed = 0;
    this.passed = 0;
    this.failed = 0;
    this.delegate.onRunStart?.(args);
    this.startTimer();
    this.renderFooter();
  }

  onScenarioStart(scenario: ScenarioSpec): void {
    this.withFooterPaused(() => this.delegate.onScenarioStart(scenario));
  }

  onScenarioEnd(
    scenario: ScenarioSpec,
    result: { ok: boolean; error?: unknown; durationMs: number },
  ): void {
    this.completed += 1;
    if (result.ok) {
      this.passed += 1;
    } else {
      this.failed += 1;
    }
    this.withFooterPaused(() => this.delegate.onScenarioEnd(scenario, result));
  }

  onStepStart(args: {
    scenarioId: string;
    phase: StepPhase;
    step: OpStep;
  }): void {
    this.withFooterPaused(() => this.delegate.onStepStart(args));
  }

  onStepEnd(args: {
    scenarioId: string;
    phase: StepPhase;
    step: OpStep;
    ok: boolean;
    error?: unknown;
    durationMs: number;
  }): void {
    this.withFooterPaused(() => this.delegate.onStepEnd(args));
  }

  onSpecResult(args: {
    scenarioId: string;
    specId: string;
    stepName?: string;
    result: SolidTestSpecResult;
  }): void {
    this.withFooterPaused(() => this.delegate.onSpecResult?.(args));
  }

  attach(args: {
    scenarioId: string;
    name: string;
    contentType: string;
    data: Buffer | string;
  }): void {
    this.withFooterPaused(() => this.delegate.attach?.(args));
  }

  onRunEnd(args: {
    ok: boolean;
    total: number;
    passed: number;
    failed: number;
    durationMs: number;
  }): void {
    this.completed = args.passed + args.failed;
    this.passed = args.passed;
    this.failed = args.failed;
    this.total = args.total;
    this.stopTimer();
    this.withFooterPaused(() => this.delegate.onRunEnd?.(args), false);
  }

  private startTimer(): void {
    this.stopTimer();
    if (!this.isInteractive()) {
      return;
    }
    this.timer = setInterval(() => this.renderFooter(), 1_000);
    this.timer.unref?.();
  }

  private stopTimer(): void {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = undefined;
  }

  private withFooterPaused(callback: () => void, renderAfter = true): void {
    this.clearFooter();
    callback();
    if (renderAfter) {
      this.renderFooter();
    }
  }

  private renderFooter(): void {
    if (!this.isInteractive()) {
      return;
    }

    const terminalWidth = process.stdout.columns || 80;
    const elapsed = formatElapsed(Date.now() - this.startedAt);
    const progressText = `${this.completed}/${this.total}`;
    const resultText = `${ANSI_GREEN}${this.passed} passed${ANSI_COLOR_OFF}${ANSI_DIM} | ${ANSI_BOLD_OFF}${this.failed ? ANSI_RED : ANSI_DIM}${this.failed} failed${this.failed ? ANSI_COLOR_OFF : ANSI_BOLD_OFF}`;
    const footer = [
      `${ANSI_BOLD}Tests${ANSI_BOLD_OFF}: ${this.renderProgressBar(terminalWidth)} ${progressText}`,
      `${ANSI_BOLD}Elapsed${ANSI_BOLD_OFF}: ${elapsed}`,
      resultText,
    ].join(`${ANSI_DIM} | ${ANSI_BOLD_OFF}`);

    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(truncateAnsiText(`${ANSI_INVERSE} ${footer} ${ANSI_INVERSE_OFF}`, terminalWidth));
    this.rendered = true;
  }

  private clearFooter(): void {
    if (!this.rendered || !this.isInteractive()) {
      return;
    }
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    this.rendered = false;
  }

  private renderProgressBar(terminalWidth: number): string {
    const width = terminalWidth >= 120 ? 30 : terminalWidth >= 90 ? 22 : 14;
    const ratio = this.total > 0 ? Math.min(1, this.completed / this.total) : 0;
    const filled = Math.round(width * ratio);
    const empty = Math.max(0, width - filled);
    return `[${ANSI_GREEN}${"=".repeat(filled)}${ANSI_COLOR_OFF}${" ".repeat(empty)}]`;
  }

  private isInteractive(): boolean {
    return Boolean(process.stdout.isTTY || process.env.SOLIDCTL_TEST_PROGRESS === "1");
  }
}

function formatElapsed(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}:${remainingMinutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function truncateAnsiText(text: string, maxWidth: number): string {
  if (maxWidth <= 0) {
    return "";
  }

  let visibleWidth = 0;
  let index = 0;
  let output = "";
  let hasEscape = false;

  while (index < text.length) {
    if (text[index] === "\u001b") {
      const match = /\u001b\[[0-9;]*m/.exec(text.slice(index));
      if (!match) {
        break;
      }
      output += match[0];
      hasEscape = true;
      index += match[0].length;
      continue;
    }

    if (visibleWidth >= maxWidth) {
      break;
    }

    output += text[index];
    visibleWidth += 1;
    index += 1;
  }

  if (index < text.length && maxWidth >= 1) {
    output = trimAnsiText(output, maxWidth - 1) + "…";
  }

  if (hasEscape && !output.endsWith(ANSI_INVERSE_OFF)) {
    output += ANSI_INVERSE_OFF;
  }

  return output;
}

function trimAnsiText(text: string, maxWidth: number): string {
  let visibleWidth = 0;
  let index = 0;
  let output = "";

  while (index < text.length && visibleWidth < maxWidth) {
    if (text[index] === "\u001b") {
      const match = /\u001b\[[0-9;]*m/.exec(text.slice(index));
      if (!match) {
        break;
      }
      output += match[0];
      index += match[0].length;
      continue;
    }

    output += text[index];
    visibleWidth += 1;
    index += 1;
  }

  return output;
}
