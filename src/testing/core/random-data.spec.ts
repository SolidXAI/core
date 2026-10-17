// Purpose: random test data must look like real input (forms and APIs validate it) and must not
// repeat within a run (a run often creates several records with unique fields).

import type { TestContext } from "../contracts/runtime-context.types";
import { interpolateDeep, interpolateString } from "./interpolation";
import { parseRandomToken, RandomDataRegistry } from "./random-data";
import { FIRST_NAMES, LAST_NAMES } from "./random-names";
import { SimpleResourceStore } from "./resource-store";
import { StepRegistry } from "./step-registry";
import { registerUtilSteps } from "../steps/util";

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

function many(registry: RandomDataRegistry, name: string, args: Record<string, unknown> = {}, n = 200): string[] {
  return Array.from({ length: n }, () => registry.generate(name, args));
}

describe("random generators: formats", () => {
  const registry = new RandomDataRegistry();

  it("firstName and lastName come from the locale's names", () => {
    for (const v of many(registry, "firstName", { locale: "in" }, 30)) expect(FIRST_NAMES.in).toContain(v);
    for (const v of many(registry, "lastName", { locale: "gb" }, 30)) expect(LAST_NAMES.gb).toContain(v);
    const all = new Set([...FIRST_NAMES.in, ...FIRST_NAMES.gb, ...FIRST_NAMES.us]);
    for (const v of many(registry, "firstName", {}, 50)) expect(all.has(v)).toBe(true);
  });

  it("emailAddress defaults to first.last with 4 digits at example.com", () => {
    for (const v of many(registry, "emailAddress")) expect(v).toMatch(/^[a-z]+\.[a-z]+\d{4}@example\.com$/);
  });

  it("emailAddress follows format, digits, length and domain", () => {
    expect(registry.generate("emailAddress", { format: "firstlast", digits: 0, domain: "Acme.Test" })).toMatch(/^[a-z]+@acme\.test$/);
    expect(registry.generate("emailAddress", { format: "first_last", digits: 2 })).toMatch(/^[a-z]+_[a-z]+\d{2}@example\.com$/);
    expect(registry.generate("emailAddress", { format: "flast" })).toMatch(/^[a-z][a-z]+\d{4}@example\.com$/);
    expect(registry.generate("emailAddress", { format: "random", length: 12 })).toMatch(/^[a-z0-9]{12}@example\.com$/);
  });

  it("indianMobileNo is 10 digits starting with 6-9, in each format", () => {
    for (const v of many(registry, "indianMobileNo")) expect(v).toMatch(/^[6-9]\d{9}$/);
    expect(registry.generate("indianMobileNo", { format: "national" })).toMatch(/^[6-9]\d{4} \d{5}$/);
    expect(registry.generate("indianMobileNo", { format: "e164" })).toMatch(/^\+91[6-9]\d{9}$/);
    expect(registry.generate("indianMobileNo", { format: "international" })).toMatch(/^\+91 [6-9]\d{4} \d{5}$/);
  });

  it("britishMobileNo is 07 and 9 digits in a mobile range, in each format", () => {
    for (const v of many(registry, "britishMobileNo")) expect(v).toMatch(/^07[1-57-9]\d{8}$/);
    expect(registry.generate("britishMobileNo", { format: "national" })).toMatch(/^07[1-57-9]\d{2} \d{6}$/);
    expect(registry.generate("britishMobileNo", { format: "e164" })).toMatch(/^\+447[1-57-9]\d{8}$/);
    expect(registry.generate("britishMobileNo", { format: "international" })).toMatch(/^\+44 7[1-57-9]\d{2} \d{6}$/);
    expect(registry.generate("britishMobileNo", { fictional: true })).toMatch(/^07700900\d{3}$/);
  });

  it("americanMobileNo has a real area code and a valid exchange, in each format", () => {
    for (const v of many(registry, "americanMobileNo")) {
      expect(v).toMatch(/^[2-9]\d{2}[2-9]\d{6}$/);
      const exchange = v.slice(3, 6);
      expect(exchange.endsWith("11") || exchange === "555").toBe(false);
    }
    expect(registry.generate("americanMobileNo", { format: "national" })).toMatch(/^\(\d{3}\) \d{3}-\d{4}$/);
    expect(registry.generate("americanMobileNo", { format: "e164" })).toMatch(/^\+1\d{10}$/);
    expect(registry.generate("americanMobileNo", { format: "international" })).toMatch(/^\+1 \d{3}-\d{3}-\d{4}$/);
    expect(registry.generate("americanMobileNo", { fictional: true })).toMatch(/^\d{3}55501\d{2}$/);
  });

  it("panNo has the PAN shape, with the holder type as its 4th letter", () => {
    for (const v of many(registry, "panNo")) {
      expect(v).toMatch(/^[A-Z]{3}P[A-Z]\d{4}[A-Z]$/);
      expect(v.slice(5, 9)).not.toBe("0000");
    }
    expect(registry.generate("panNo", { holderType: "c" })).toMatch(/^[A-Z]{3}C[A-Z]\d{4}[A-Z]$/);
  });

  it("invoiceId follows prefix, separator, length and date", () => {
    expect(registry.generate("invoiceId")).toMatch(/^INV-\d{8}$/);
    expect(registry.generate("invoiceId", { prefix: "BILL", separator: "/", length: 6 })).toMatch(/^BILL\/\d{6}$/);
    expect(registry.generate("invoiceId", { prefix: "", length: 10 })).toMatch(/^\d{10}$/);
    expect(registry.generate("invoiceId", { separator: "none", length: 4 })).toMatch(/^INV\d{4}$/);
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    expect(registry.generate("invoiceId", { date: "yyyymm" })).toMatch(new RegExp(`^INV-${yyyymm}-\\d{8}$`));
  });
});

describe("random generators: no repeats in a run", () => {
  it("draws names without repeats until the pool is used up, then says so", () => {
    const registry = new RandomDataRegistry();
    const names = many(registry, "firstName", { locale: "in" }, FIRST_NAMES.in.length);
    expect(new Set(names).size).toBe(FIRST_NAMES.in.length);
    expect(() => registry.generate("firstName", { locale: "in" })).toThrow(
      `random:firstName has used all ${FIRST_NAMES.in.length} of its values in this run. Pass unique=false to allow repeats.`,
    );
    expect(() => registry.generate("firstName", { locale: "in", unique: false })).not.toThrow();
  });

  it("counts one phone number written in two formats as a repeat", () => {
    const registry = new RandomDataRegistry();
    const digits = many(registry, "britishMobileNo", { fictional: true }, 500).map((v) => `+44${v.slice(1)}`);
    const e164 = many(registry, "britishMobileNo", { fictional: true, format: "e164" }, 500);
    expect(new Set([...digits, ...e164]).size).toBe(1000);
    expect(() => registry.generate("britishMobileNo", { fictional: true })).toThrow(/has used all 1000/);
  });

  it("does not run out over 2,000 draws of a wide generator", () => {
    const registry = new RandomDataRegistry();
    for (const name of ["emailAddress", "indianMobileNo", "americanMobileNo", "panNo", "invoiceId"]) {
      const values = many(registry, name, {}, 2000);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("starts afresh in a new run", () => {
    const first = many(new RandomDataRegistry(), "firstName", { locale: "gb" }, FIRST_NAMES.gb.length);
    const second = many(new RandomDataRegistry(), "firstName", { locale: "gb" }, FIRST_NAMES.gb.length);
    expect(new Set(first)).toEqual(new Set(second));
  });
});

describe("random generators: argument errors", () => {
  const registry = new RandomDataRegistry();

  it("names the generators when one is unknown", () => {
    expect(() => registry.generate("phone")).toThrow(
      'Unknown random generator "phone". Use one of: firstName, lastName, emailAddress, indianMobileNo, britishMobileNo, americanMobileNo, panNo, invoiceId',
    );
  });

  it("names the arguments when one is unknown", () => {
    expect(() => registry.generate("panNo", { length: 5 })).toThrow('random:panNo does not take "length". It takes: holderType, unique');
  });

  it("explains a bad value", () => {
    expect(() => registry.generate("indianMobileNo", { format: "dotted" })).toThrow(
      'random:indianMobileNo "format" must be one of: digits, national, e164, international (got "dotted")',
    );
    expect(() => registry.generate("invoiceId", { length: "3" })).toThrow(
      'random:invoiceId "length" must be a whole number from 4 to 20 (got "3")',
    );
    expect(() => registry.generate("emailAddress", { domain: "not a domain" })).toThrow(
      'random:emailAddress "domain" must be a domain such as example.com (got "not a domain")',
    );
    expect(() => registry.generate("britishMobileNo", { fictional: "yes" })).toThrow(
      'random:britishMobileNo "fictional" must be true or false (got "yes")',
    );
  });
});

describe("parseRandomToken", () => {
  it("reads a bare name and a name with arguments", () => {
    expect(parseRandomToken("firstName")).toEqual({ name: "firstName", args: {} });
    expect(parseRandomToken(" emailAddress( domain = acme.test , digits=0 ) ")).toEqual({
      name: "emailAddress",
      args: { domain: "acme.test", digits: "0" },
    });
    expect(parseRandomToken("invoiceId(prefix=)")).toEqual({ name: "invoiceId", args: { prefix: "" } });
  });

  it("refuses malformed tokens", () => {
    expect(() => parseRandomToken("email address")).toThrow(/Invalid random token "random:email address"/);
    expect(() => parseRandomToken("panNo(C)")).toThrow('Invalid argument "C" in "random:panNo(C)". Write name=value');
    expect(() => parseRandomToken("invoiceId(length=6, length=8)")).toThrow('Argument "length" is given twice');
  });
});

describe("${random:...} interpolation", () => {
  it("resolves inline and as a whole value, with arguments", () => {
    const ctx = makeCtx({ randomData: new RandomDataRegistry() });
    expect(interpolateString("mail ${random:emailAddress(domain=acme.test, digits=0, format=firstlast)}", ctx)).toMatch(
      /^mail [a-z]+@acme\.test$/,
    );
    const step = interpolateDeep({ with: { json: { phone: "${random:indianMobileNo(format=e164)}" } } }, ctx);
    expect(step.with.json.phone).toMatch(/^\+91[6-9]\d{9}$/);
  });

  it("gives a new value each time, and works with pipe transforms", () => {
    const ctx = makeCtx({ randomData: new RandomDataRegistry() });
    const a = interpolateString("${random:invoiceId}", ctx);
    const b = interpolateString("${random:invoiceId}", ctx);
    expect(a).not.toBe(b);
    expect(interpolateString("${random:invoiceId(length=6) | match:-(\\d+)$}", ctx)).toMatch(/^\d{6}$/);
  });

  it("keeps values unique across the scenarios of a run", () => {
    const base = { resources: new SimpleResourceStore(), randomData: new RandomDataRegistry() };
    const seen = new Set<string>();
    for (let s = 0; s < FIRST_NAMES.us.length; s += 1) {
      seen.add(interpolateString("${random:firstName(locale=us)}", makeCtx({ ...base, scenarioId: `s${s}` })));
    }
    expect(seen.size).toBe(FIRST_NAMES.us.length);
  });

  it("falls back to one registry per resource store when the context has none", () => {
    const resources = new SimpleResourceStore();
    const values = Array.from({ length: FIRST_NAMES.gb.length }, () =>
      interpolateString("${random:firstName(locale=gb)}", makeCtx({ resources })),
    );
    expect(new Set(values).size).toBe(FIRST_NAMES.gb.length);
    expect(() => interpolateString("${random:firstName(locale=gb)}", makeCtx({ resources }))).toThrow(/has used all/);
    expect(() => interpolateString("${random:firstName(locale=gb)}", makeCtx())).not.toThrow();
  });
});

describe("util.random", () => {
  const registry = new StepRegistry();
  registerUtilSteps(registry);
  const step = registry.get("util.random");

  it("returns one value, taking typed or text arguments", async () => {
    const ctx = makeCtx({ randomData: new RandomDataRegistry() });
    await expect(step(ctx, { op: "util.random", with: { generator: "invoiceId", args: { length: 5, prefix: "PO" } } } as any)).resolves.toMatch(
      /^PO-\d{5}$/,
    );
    await expect(step(ctx, { op: "util.random", with: { generator: "britishMobileNo", args: { fictional: "true" } } } as any)).resolves.toMatch(
      /^07700900\d{3}$/,
    );
  });

  it("explains a missing generator and bad args", async () => {
    const ctx = makeCtx();
    await expect(step(ctx, { op: "util.random", with: {} } as any)).rejects.toThrow('Missing "generator" in step.with for op "util.random"');
    await expect(step(ctx, { op: "util.random", with: { generator: "panNo", args: ["C"] } } as any)).rejects.toThrow(
      '"args" must be an object for op "util.random"',
    );
  });
});
