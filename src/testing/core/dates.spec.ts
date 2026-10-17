// Purpose: dates must come out right whatever the machine's clock and time zone, so every case fixes
// the clock and names its time zone. Quoted argument values and the scanning behind them are covered
// here too, because dates are what needs them (`format='D MMM, YYYY'`).

import type { TestContext } from "../contracts/runtime-context.types";
import { registerUtilSteps } from "../steps/util";
import { parseCallToken } from "./call-args";
import { resolveNow } from "./dates";
import { collectSecretKeys, interpolateDeep, interpolateString } from "./interpolation";
import { RandomDataRegistry } from "./random-data";
import { SimpleResourceStore } from "./resource-store";
import { StepRegistry } from "./step-registry";
import { findTokens, splitOutsideQuotes } from "./token-scan";

// 17 October 2026, 10:29:05 UTC = 15:59:05 in India.
const NOW = "2026-10-17T10:29:05Z";

function makeCtx(): TestContext {
  return {
    scenarioId: "spec",
    scenarioType: "api",
    params: {},
    resources: new SimpleResourceStore(),
    reporter: {} as any,
    randomData: new RandomDataRegistry(),
  } as TestContext;
}

function gen(ctx: TestContext, token: string): string {
  return interpolateString(token, ctx);
}

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date(NOW));
});

afterEach(() => {
  jest.useRealTimers();
});

describe("${now:...}", () => {
  it("gives each kind in the requested zone", () => {
    expect(resolveNow("date", { tz: "utc" })).toBe("2026-10-17");
    expect(resolveNow("time", { tz: "utc" })).toBe("10:29:05");
    expect(resolveNow("datetime", { tz: "utc" })).toBe("2026-10-17 10:29:05");
    expect(resolveNow("iso", { tz: "utc" })).toBe("2026-10-17T10:29:05Z");
    expect(resolveNow("epoch", { tz: "utc" })).toBe(String(Date.parse(NOW)));
    expect(resolveNow("time", { tz: "Asia/Kolkata" })).toBe("15:59:05");
    expect(resolveNow("iso", { tz: "Asia/Kolkata" })).toBe("2026-10-17T15:59:05+05:30");
  });

  it("shifts by an offset", () => {
    expect(resolveNow("date", { tz: "utc", offset: "+7d" })).toBe("2026-10-24");
    expect(resolveNow("date", { tz: "utc", offset: "-1d" })).toBe("2026-10-16");
    expect(resolveNow("date", { tz: "utc", offset: "+1y" })).toBe("2027-10-17");
    expect(resolveNow("date", { tz: "utc", offset: "+2w" })).toBe("2026-10-31");
    expect(resolveNow("datetime", { tz: "utc", offset: "+1d+2h" })).toBe("2026-10-18 12:29:05");
    expect(resolveNow("datetime", { tz: "utc", offset: "-90min" })).toBe("2026-10-17 08:59:05");
    expect(resolveNow("date", { tz: "utc", offset: "0" })).toBe("2026-10-17");
  });

  it("tells months from minutes, and stops at the end of a short month", () => {
    expect(resolveNow("date", { tz: "utc", offset: "+1m" })).toBe("2026-11-17");
    jest.setSystemTime(new Date("2026-01-31T12:00:00Z"));
    expect(resolveNow("date", { tz: "utc", offset: "+1m" })).toBe("2026-02-28");
  });

  it("formats with any dayjs pattern, and literal text in brackets", () => {
    expect(resolveNow("date", { tz: "utc", format: "DD-MMM-YYYY" })).toBe("17-Oct-2026");
    expect(resolveNow("date", { tz: "utc", format: "DD/MM/YYYY" })).toBe("17/10/2026");
    expect(resolveNow("date", { tz: "utc", format: "D MMMM YYYY [at] HH:mm" })).toBe("17 October 2026 at 10:29");
    expect(resolveNow("date", { tz: "utc", format: "epoch" })).toBe(String(Date.parse(NOW)));
  });

  it("refuses the Java and C# patterns dayjs would misread", () => {
    expect(() => resolveNow("date", { format: "dd/mm/yyyy" })).toThrow(
      'now:date "format" uses "yyyy", which dayjs does not know. Use YYYY for the year (YY for two digits)',
    );
    expect(() => resolveNow("date", { format: "DD/MM/yy" })).toThrow(/uses "yy"/);
    expect(() => resolveNow("date", { format: "dd-MM-YYYY" })).toThrow(
      'now:date "format" uses "dd", which dayjs reads as the short weekday (Sa). Use DD for the day of the month',
    );
    expect(() => resolveNow("date", { format: "YYYY-mm-DD" })).toThrow(
      'now:date "format" uses "mm" with no hour, which dayjs reads as minutes. Use MM for the month',
    );
    expect(resolveNow("date", { tz: "utc", format: "ddd DD MMM" })).toBe("Sat 17 Oct");
    expect(resolveNow("date", { tz: "utc", format: "HH:mm" })).toBe("10:29");
    expect(resolveNow("date", { tz: "utc", format: "[yyyy] YYYY" })).toBe("yyyy 2026");
  });

  it("explains an unknown kind, zone, offset and argument", () => {
    expect(() => resolveNow("day")).toThrow('Unknown now kind "day". Use one of: date, time, datetime, iso, epoch');
    expect(() => resolveNow("date", { tz: "Mars/Olympus" })).toThrow(
      'now:date "tz" must be local, utc or an IANA time zone such as Asia/Kolkata (got "Mars/Olympus")',
    );
    expect(() => resolveNow("date", { offset: "tomorrow" })).toThrow(
      'now:date "offset" must be 0 or terms such as +7d, -1m or +1d+2h (got "tomorrow")',
    );
    expect(() => resolveNow("date", { zone: "utc" })).toThrow('now:date does not take "zone". It takes: offset, format, tz');
  });
});

describe("quoted argument values", () => {
  it("resolves the token with a quoted format holding a comma", () => {
    const ctx = makeCtx();
    expect(gen(ctx, "${now:date(tz=utc, format='D MMM, YYYY')}")).toBe("17 Oct, 2026");
    expect(gen(ctx, '${now:date(tz=utc, format="D MMM, YYYY")}')).toBe("17 Oct, 2026");
  });

  it("lets a quoted value hold a pipe and a brace", () => {
    const ctx = makeCtx();
    expect(gen(ctx, "${now:date(tz=utc, format='DD | MM')}")).toBe("17 | 10");
    expect(gen(ctx, "${now:date(tz=utc, format='[}] DD')}")).toBe("} 17");
    expect(gen(ctx, "before ${now:date(tz=utc)} and ${now:date(tz=utc, offset=+1d)} after")).toBe(
      "before 2026-10-17 and 2026-10-18 after",
    );
  });

  it("still applies pipe transforms outside the quotes", () => {
    const ctx = makeCtx();
    expect(gen(ctx, "${now:date(tz=utc, format='DD | MM') | match:^(\\d+)}")).toBe("17");
  });

  it("asks for quotes when a bare value has a space or other punctuation", () => {
    const ctx = makeCtx();
    expect(() => gen(ctx, "${now:date(format=D MMM YYYY)}")).toThrow(`now:date "format" must be quoted: format='D MMM YYYY'`);
    expect(() => gen(ctx, "${now:date(format=D MMM, YYYY)}")).toThrow(/must be quoted|Invalid argument/);
  });

  it("reports an unclosed quote", () => {
    expect(() => gen(makeCtx(), "${now:date(format='D MMM)}")).toThrow(`Unclosed quote in "now:date(format='D MMM)"`);
  });

  it("reads a backslash as the quote character itself", () => {
    expect(parseCallToken("random", "generator", "invoiceId(prefix='it\\'s', length=6)")).toEqual({
      name: "invoiceId",
      args: { prefix: "it's", length: "6" },
    });
  });

  it("refuses text after a closing quote", () => {
    expect(() => parseCallToken("random", "generator", "invoiceId(prefix='PO'X)")).toThrow(/Invalid argument/);
  });
});

describe("token scanning", () => {
  it("finds tokens, skipping quoted braces", () => {
    expect(findTokens("a ${x} b ${now:date(format='}')} c").map((t) => t.inner)).toEqual(["x", "now:date(format='}')"]);
  });

  it("leaves a token that never closes as plain text", () => {
    expect(findTokens("price ${oops")).toEqual([]);
    expect(findTokens("empty ${} and ${x}").map((t) => t.inner)).toEqual(["x"]);
  });

  it("falls back to the first brace when a quote never closes", () => {
    expect(findTokens("${data:x[O'B]} and ${y}").map((t) => t.inner)).toEqual(["data:x[O'B]", "y"]);
  });

  it("splits on pipes outside quotes, and everywhere when a quote is unbalanced", () => {
    expect(splitOutsideQuotes("a(x='1|2') | match:b", "|")).toEqual(["a(x='1|2') ", " match:b"]);
    expect(splitOutsideQuotes("a | match:it's", "|")).toEqual(["a ", " match:it's"]);
  });

  it("collects secret keys from nested values and keys", () => {
    expect(
      collectSecretKeys({
        a: "${secret:one}",
        b: ["x ${secret:two} y", { c: "${secret:three | default:z}" }],
        "${secret:four}": 1,
        d: "${env:NOT_A_SECRET}",
      }).sort(),
    ).toEqual(["four", "one", "three", "two"].sort());
  });
});

describe("random:date", () => {
  const iso = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

  it("gives a day inside the range, in the default format", () => {
    const ctx = makeCtx();
    const days = new Set<string>();
    for (let i = 0; i < 200; i += 1) days.add(gen(ctx, "${random:date(from=2026-10-10, to=2026-10-12, tz=utc)}"));
    expect([...days].sort()).toEqual(["2026-10-10", "2026-10-11", "2026-10-12"]);
  });

  it("builds a date of birth from shifts", () => {
    const ctx = makeCtx();
    for (let i = 0; i < 100; i += 1) {
      const v = gen(ctx, "${random:date(from=-60y, to=-18y, tz=utc)}");
      expect(iso(v)).toBe(true);
      expect(v >= "1966-10-17" && v <= "2008-10-17").toBe(true);
    }
  });

  it("allows repeats by default, and unique=true uses each day once", () => {
    const ctx = makeCtx();
    for (let i = 0; i < 20; i += 1) gen(ctx, "${random:date(from=2026-10-10, to=2026-10-12, tz=utc)}");
    const fresh = makeCtx();
    const used = [1, 2, 3].map(() => gen(fresh, "${random:date(from=2026-10-10, to=2026-10-12, tz=utc, unique=true)}"));
    expect(new Set(used).size).toBe(3);
    expect(() => gen(fresh, "${random:date(from=2026-10-10, to=2026-10-12, tz=utc, unique=true)}")).toThrow(
      "random:date has used all 3 of its values in this run. Pass unique=false to allow repeats.",
    );
  });

  it("counts distinct rendered values, so a coarse format has fewer", () => {
    const fresh = makeCtx();
    const token = "${random:date(from=2026-01-01, to=2026-02-28, tz=utc, format=YYYY-MM, unique=true)}";
    expect(new Set([gen(fresh, token), gen(fresh, token)]).size).toBe(2);
    expect(() => gen(fresh, token)).toThrow(/has used all 2 of its values/);
  });

  it("draws a long range by retrying", () => {
    const ctx = makeCtx();
    expect(() => {
      for (let i = 0; i < 20; i += 1) gen(ctx, "${random:date(from=-100y, to=+100y, tz=utc, unique=true)}");
    }).not.toThrow();
  });

  it("gives a time inside the range with time=random", () => {
    const ctx = makeCtx();
    for (let i = 0; i < 100; i += 1) {
      const v = gen(ctx, "${random:date(from=2026-10-10, to=2026-10-10, tz=utc, time=random)}");
      expect(v).toMatch(/^2026-10-10 \d{2}:\d{2}$/);
    }
  });

  it("keeps the time inside a window", () => {
    const ctx = makeCtx();
    for (let i = 0; i < 200; i += 1) {
      const v = gen(ctx, "${random:date(from=today, to=+3d, tz=utc, time=09:00-18:00, format='YYYY-MM-DD HH:mm')}");
      const [, hh, mm] = /(\d{2}):(\d{2})$/.exec(v)!;
      const minutes = Number(hh) * 60 + Number(mm);
      expect(minutes >= 540 && minutes <= 1080).toBe(true);
    }
  });

  it("follows the zone: now is 15:59 in India", () => {
    const ctx = makeCtx();
    expect(gen(ctx, "${random:date(from=now, to=now, tz=Asia/Kolkata, time=random, format=HH:mm)}")).toBe("15:59");
  });

  it("formats as iso and epoch", () => {
    const ctx = makeCtx();
    expect(gen(ctx, "${random:date(from=now, to=now, tz=utc, time=random, format=iso)}")).toBe("2026-10-17T10:29:05Z");
    expect(gen(ctx, "${random:date(from=now, to=now, time=random, format=epoch)}")).toBe(String(Date.parse(NOW)));
  });

  it("explains a bad range, point, time, format and zone", () => {
    const ctx = makeCtx();
    expect(() => gen(ctx, "${random:date(from=2027-01-01, to=2026-01-01)}")).toThrow(
      'random:date "from" (2027-01-01) is after "to" (2026-01-01)',
    );
    expect(() => gen(ctx, "${random:date(from=soon)}")).toThrow(
      'random:date "from" must be a date such as today, now, 2026-10-17, -18y or +1d+2h (got "soon")',
    );
    expect(() => gen(ctx, "${random:date(from=2026-13-45)}")).toThrow(/is not a real date/);
    expect(() => gen(ctx, "${random:date(time=noon)}")).toThrow(
      'random:date "time" must be none, random or a window such as 09:00-18:00 (got "noon")',
    );
    expect(() => gen(ctx, "${random:date(time=18:00-09:00)}")).toThrow('random:date "time" window 18:00-09:00 ends before it starts');
    expect(() => gen(ctx, "${random:date(format=dd/mm/yyyy)}")).toThrow(/uses "yyyy"/);
    expect(() => gen(ctx, "${random:date(tz=Mars/Olympus)}")).toThrow(/"tz" must be local, utc or an IANA time zone/);
    expect(() => gen(ctx, "${random:date(unique=maybe)}")).toThrow('random:date "unique" must be true or false (got "maybe")');
  });

  it("names its arguments", () => {
    expect(() => new RandomDataRegistry().generate("date", { between: "x" })).toThrow(
      'random:date does not take "between". It takes: from, to, time, format, tz, unique',
    );
  });
});

describe("a whole-value token is resolved once", () => {
  it("does not draw a second random value", () => {
    const ctx = makeCtx();
    const token = "${random:date(from=2026-10-10, to=2026-10-11, tz=utc, unique=true)}";
    const first = interpolateDeep({ a: token }, ctx).a;
    const second = interpolateDeep({ a: token }, ctx).a;
    expect(new Set([first, second]).size).toBe(2);
  });
});

describe("util.now", () => {
  const registry = new StepRegistry();
  registerUtilSteps(registry);
  const step = registry.get("util.now");
  const run = (withArgs: Record<string, unknown>) => step(makeCtx(), { op: "util.now", with: withArgs } as any);

  it("returns today's date by default, and takes a kind and arguments", async () => {
    await expect(run({ args: { tz: "utc" } })).resolves.toBe("2026-10-17");
    await expect(run({ kind: "iso", args: { tz: "utc", offset: "+1d" } })).resolves.toBe("2026-10-18T10:29:05Z");
  });

  it("explains an unknown kind and bad args", async () => {
    await expect(run({ kind: "day" })).rejects.toThrow('Unknown now kind "day"');
    await expect(run({ args: ["utc"] })).rejects.toThrow('"args" must be an object for op "util.now"');
  });
});
