import type { TestContext } from "../contracts/runtime-context.types";

export function attachJson(
  ctx: TestContext,
  name: string,
  obj: unknown,
): void {
  if (!ctx.reporter.attach) return;
  ctx.reporter.attach({
    scenarioId: ctx.scenarioId,
    name,
    contentType: "application/json",
    data: JSON.stringify(obj, null, 2),
  });
}

export function attachText(ctx: TestContext, name: string, text: string): void {
  if (!ctx.reporter.attach) return;
  ctx.reporter.attach({
    scenarioId: ctx.scenarioId,
    name,
    contentType: "text/plain",
    data: text,
  });
}
