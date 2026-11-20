import type { StepDataUsed, TestContext } from "../contracts/runtime-context.types";

/** Longest value kept in a step's report; generated data is short, so this only guards against a whole page of text. */
const MAX_VALUE_LENGTH = 500;

/** Adds a value the current step generated or extracted to its report (see {@link StepDataUsed}). */
export function recordStepData(ctx: TestContext, entry: Omit<StepDataUsed, "value"> & { value: unknown }): void {
  if (!ctx.stepData) return;
  const text = typeof entry.value === "string" ? entry.value : JSON.stringify(entry.value) ?? String(entry.value);
  ctx.stepData.push({
    ...entry,
    value: text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}…` : text,
  });
}
