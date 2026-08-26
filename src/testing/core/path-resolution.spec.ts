// Purpose: lock down lookup-path parsing and token interpolation — the behaviours that decide
// whether a scenario file's `${res:...}` / `${data:...}` references resolve or silently vanish.

import type { TestContext } from "../contracts/runtime-context.types";
import { interpolateDeep, interpolateString } from "./interpolation";
import { parsePathSegments } from "./path-segments";
import { SimpleResourceStore } from "./resource-store";

function makeCtx(overrides: Partial<TestContext> = {}): TestContext {
  return {
    scenarioId: "spec",
    scenarioType: "api",
    params: {},
    resources: new SimpleResourceStore(),
    reporter: { onScenarioStart: () => {}, onStep: () => {}, onScenarioEnd: () => {} } as any,
    ...overrides,
  } as TestContext;
}

describe("parsePathSegments", () => {
  it("treats dot and bracket notation as equivalent", () => {
    expect(parsePathSegments("a.b.0.c")).toEqual(["a", "b", "0", "c"]);
    expect(parsePathSegments("a.b[0].c")).toEqual(["a", "b", "0", "c"]);
    expect(parsePathSegments('a["b"].c')).toEqual(["a", "b", "c"]);
  });

  it("keeps quoted keys containing spaces and punctuation intact", () => {
    expect(parsePathSegments('book["Clean Code"].title')).toEqual(["book", "Clean Code", "title"]);
    expect(parsePathSegments("book['a.b'].title")).toEqual(["book", "a.b", "title"]);
  });

  it("returns no segments for an empty path", () => {
    expect(parsePathSegments("")).toEqual([]);
  });
});

describe("SimpleResourceStore", () => {
  function seeded() {
    const store = new SimpleResourceStore();
    store.set("createBook", {
      status: 201,
      bodyText: '{"data":{"title":"Clean Code"}}',
      bodyJson: { data: { title: "Clean Code" }, result: [{ id: 7 }, { id: 8 }] },
    });
    return store;
  }

  it("resolves dot paths", () => {
    expect(seeded().get("createBook.bodyJson.data.title")).toBe("Clean Code");
    expect(seeded().get("createBook.status")).toBe(201);
  });

  it("resolves array elements by numeric segment", () => {
    expect(seeded().get("createBook.bodyJson.result.0.id")).toBe(7);
  });

  it("resolves array elements by bracket index, equivalently", () => {
    const store = seeded();
    expect(store.get("createBook.bodyJson.result[0].id")).toBe(7);
    expect(store.get("createBook.bodyJson.result[1].id")).toBe(8);
    // the two spellings must agree — this asymmetry with ${data:...} was the original bug
    expect(store.get("createBook.bodyJson.result[0].id")).toBe(
      store.get("createBook.bodyJson.result.0.id"),
    );
  });

  it("returns undefined for a missing path rather than throwing", () => {
    expect(seeded().get("createBook.bodyJson.nope.deeper")).toBeUndefined();
    expect(seeded().get("neverSaved")).toBeUndefined();
  });

  it("round-trips: anything readable by bracket path is also writable by one", () => {
    const store = new SimpleResourceStore();
    store.set('a["b c"].d', 42);
    expect(store.get('a["b c"].d')).toBe(42);
    expect(store.get("a.b c.d")).toBe(42);
  });

  it("has() follows get()", () => {
    const store = seeded();
    expect(store.has("createBook.bodyJson.result[0].id")).toBe(true);
    expect(store.has("createBook.bodyJson.result[9].id")).toBe(false);
  });
});

describe("interpolation", () => {
  it("stringifies non-string ${res:...} values", () => {
    const ctx = makeCtx();
    ctx.resources.set("r", { status: 200, bodyJson: { id: 1 } });
    // the whole object flattens to text — which is why assert.httpStatus `from` and
    // assert.jsonPath `from` can never receive a live response object
    expect(interpolateDeep("${res:r}", ctx)).toBe('{"status":200,"bodyJson":{"id":1}}');
    // a scalar leaf survives intact, because the store walks the object before flattening
    expect(interpolateDeep("${res:r.bodyJson.id}", ctx)).toBe("1");
  });

  it("resolves ${res:...} bracket paths", () => {
    const ctx = makeCtx();
    ctx.resources.set("r", { bodyJson: { result: [{ id: 7 }] } });
    expect(interpolateDeep("${res:r.bodyJson.result[0].id}", ctx)).toBe("7");
    expect(interpolateDeep("${res:r.bodyJson.result.0.id}", ctx)).toBe("7");
  });

  it("preserves the raw record for ${data:..._rec} only when it is the entire value", () => {
    const ctx = makeCtx({ testData: { book: { CleanCode: { title: "Clean Code", pages: 464 } } } });
    expect(interpolateDeep('${data:book["CleanCode"]._rec}', ctx)).toEqual({
      title: "Clean Code",
      pages: 464,
    });
    // embedded in a larger string it has to flatten, since the result must stay a string
    expect(interpolateDeep('x ${data:book["CleanCode"]._rec}', ctx)).toBe(
      'x {"title":"Clean Code","pages":464}',
    );
    expect(interpolateDeep('${data:book["CleanCode"].title}', ctx)).toBe("Clean Code");
  });

  it("resolves ${secret:...} and keeps it out of nothing else", () => {
    const ctx = makeCtx({ secrets: { "test-username": "alice" } });
    expect(interpolateDeep("${secret:test-username}", ctx)).toBe("alice");
    expect(() => interpolateString("${secret:absent}", ctx)).toThrow(/Missing secret/);
  });

  it("throws a named error for an unsaved resource rather than yielding undefined", () => {
    expect(() => interpolateString("${res:neverSaved.id}", makeCtx())).toThrow(/Missing resource/);
  });

  it("recurses through objects and arrays", () => {
    const ctx = makeCtx({ params: { n: "1" } });
    expect(interpolateDeep({ a: ["${params.n}", { b: "${params.n}" }] }, ctx)).toEqual({
      a: ["1", { b: "1" }],
    });
  });
});
