import type { Browser, Page } from "playwright";
import { chromium } from "playwright";

import type { HealingPolicy, ScenarioSpec } from "../contracts/testing-metadata.types";
import { fingerprintSelectors } from "../adapters/ui/resolve-target";
import { createStepExecutor } from "./step-executor";
import { CAPABILITIES, listOps } from "./index";

const FORM = `
  <form aria-label="Task">
    <label>Title <input name="title" data-testid="task-title"></label>
    <button type="button" onclick="document.getElementById('out').textContent='saved:'+document.querySelector('[name=title]').value">Save task</button>
  </form>
  <p id="out"></p>`;

describe("step executor", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
  });
  afterAll(async () => {
    await browser.close();
  });
  beforeEach(async () => {
    page = await browser.newPage();
    await page.setContent(FORM);
  });
  afterEach(async () => {
    await page.close();
  });

  const executor = (healing?: HealingPolicy) =>
    createStepExecutor({ page, healing, defaultTimeoutMs: 3_000 });

  it("runs steps with the runner's handlers and interpolates shared resources", async () => {
    const ex = executor();
    ex.context.resources.set("task", { title: "Buy milk" });
    expect((await ex.runStep({ op: "util.require", with: { resource: "task" } })).ok).toBe(true);
    expect((await ex.runStep({ op: "ui.fill", with: { selector: "[name=title]", value: "${res:task.title}" } })).ok).toBe(true);
    await ex.runStep({ op: "ui.click", with: { selector: "role=button[name=\"Save task\"]" } });
    const check = await ex.runStep({ op: "ui.expectText", with: { selector: "#out", equals: "saved:Buy milk" } });
    expect(check).toMatchObject({ ok: true, heals: [] });
  });

  it("reports a failing step without throwing", async () => {
    const result = await executor().runStep({ op: "ui.expectText", with: { selector: "#out", equals: "nope", timeoutMs: 300 } });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Expected text to equal "nope"/);
  });

  it("heals a missing selector from its fallbacks and records the heal", async () => {
    const result = await executor().runStep(
      {
        op: "ui.fill",
        name: "Enter title",
        with: { selector: "#gone", fallbacks: [".also-gone", "[data-testid=task-title]"], value: "A" },
      },
      { phase: "when", stepPath: "steps[2].when" },
    );
    expect(result.ok).toBe(true);
    expect(result.heals).toEqual([
      expect.objectContaining({
        stepPath: "steps[2].when",
        op: "ui.fill",
        stepName: "Enter title",
        from: "#gone",
        to: "[data-testid=task-title]",
        strategy: "fallback",
        policy: "report",
      }),
    ]);
    expect(await page.inputValue("[name=title]")).toBe("A");
  });

  it("heals from a fingerprint when every selector misses", async () => {
    const result = await executor("auto").runStep({
      op: "ui.click",
      with: { selector: "#old-save", fingerprint: { role: "button", name: "save task", within: "role=form[name=\"Task\"]" } },
    });
    expect(result.ok).toBe(true);
    expect(result.heals[0]).toMatchObject({ strategy: "fingerprint", policy: "auto" });
    expect(await page.textContent("#out")).toBe("saved:");
  });

  it("never heals into an ambiguous match", async () => {
    await page.setContent(`<button>Go</button><button>Go</button>`);
    const result = await executor().runStep({
      op: "ui.click",
      with: { selector: "#missing", fallbacks: ["text=Go"], timeoutMs: 3_000 },
    });
    expect(result.ok).toBe(false);
    expect(result.heals).toEqual([]);
  }, 15_000);

  it("uses only the primary selector when healing is off", async () => {
    const result = await executor("off").runStep({
      op: "ui.fill",
      with: { selector: "#gone", fallbacks: ["[data-testid=task-title]"], value: "A", timeoutMs: 500 },
    });
    expect(result.ok).toBe(false);
    expect(result.heals).toEqual([]);
  });

  it("matches aria snapshot templates and explains a mismatch", async () => {
    const ex = executor();
    const ok = await ex.runStep({
      op: "ui.expectAriaSnapshot",
      with: { selector: "form", snapshot: '- textbox "Title"\n- button "Save task"' },
    });
    expect(ok.ok).toBe(true);
    const bad = await ex.runStep({
      op: "ui.expectAriaSnapshot",
      with: { snapshot: '- button "Delete task"', timeoutMs: 500 },
    });
    expect(bad.ok).toBe(false);
    expect(bad.error).toMatch(/did not match[\s\S]*Received:[\s\S]*Save task/);
  });

  it("runs a whole scenario and attributes heals to step paths", async () => {
    const scenario: ScenarioSpec = {
      id: "create-task",
      type: "ui",
      steps: [
        { when: { op: "ui.fill", with: { selector: "#gone", fallbacks: ["[name=title]"], value: "B" } } },
        { and: { op: "ui.click", with: { selector: "text=Save task" } } },
        { then: [{ op: "ui.expectText", with: { selector: "#out", contains: "saved:B" } }] },
      ],
    };
    const result = await executor().runScenario(scenario);
    expect(result.ok).toBe(true);
    expect(result.steps.map((s) => s.stepPath)).toEqual(["steps[0].when", "steps[1].and", "steps[2].then[0]"]);
    expect(result.heals).toEqual([expect.objectContaining({ scenarioId: "create-task", stepPath: "steps[0].when" })]);
  });

  it("leaves the caller's page open", async () => {
    const ex = executor();
    await ex.ui.stop();
    expect(page.isClosed()).toBe(false);
  });
});

describe("runtime surface", () => {
  it("lists every built-in op including the new aria step", () => {
    expect(listOps()).toEqual(expect.arrayContaining(["ui.click", "ui.expectAriaSnapshot", "api.request", "assert.equals"]));
    expect(CAPABILITIES).toEqual(expect.arrayContaining(["selfHealing", "dependsOn", "heals"]));
  });

  it("builds fingerprint selectors most-specific first", () => {
    expect(fingerprintSelectors({ testId: "save", role: "button", name: "Save", within: "role=dialog" })).toEqual([
      'role=dialog >> [data-testid="save"]',
      'role=dialog >> role=button[name="Save"i]',
    ]);
  });
});
