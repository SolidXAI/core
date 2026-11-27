import { resolveWithAliases } from "./secret-aliases";

describe("resolveWithAliases", () => {
  const store: Record<string, any> = {
    "th-12-all-ADMIN_PASSWORD": "stored-admin",
    "ADMIN_USER": "plain-admin",
    "th-12-all-TOKEN": "stored-token",
  };
  const resolveAvailable = jest.fn(async (names: string[]) =>
    names.reduce((out, name) => {
      if (name in store) out[name] = store[name];
      return out;
    }, {} as Record<string, any>),
  );

  beforeEach(() => resolveAvailable.mockClear());

  it("resolves a mapped key from its stored alias, keyed by the scenario key", async () => {
    const result = await resolveWithAliases(
      ["ADMIN_PASSWORD"],
      { ADMIN_PASSWORD: "th-12-all-ADMIN_PASSWORD" },
      resolveAvailable,
    );
    expect(result).toEqual({ ADMIN_PASSWORD: "stored-admin" });
    expect(resolveAvailable).toHaveBeenCalledWith(["th-12-all-ADMIN_PASSWORD"]);
  });

  it("resolves an unmapped key by its own name", async () => {
    const result = await resolveWithAliases(["ADMIN_USER"], {}, resolveAvailable);
    expect(result).toEqual({ ADMIN_USER: "plain-admin" });
    expect(resolveAvailable).toHaveBeenCalledWith(["ADMIN_USER"]);
  });

  it("falls back to the plain key when the alias is missing in the store", async () => {
    const result = await resolveWithAliases(
      ["ADMIN_USER"],
      { ADMIN_USER: "th-12-all-ADMIN_USER" },
      resolveAvailable,
    );
    expect(result).toEqual({ ADMIN_USER: "plain-admin" });
    expect(resolveAvailable).toHaveBeenCalledTimes(2);
    expect(resolveAvailable).toHaveBeenNthCalledWith(1, ["th-12-all-ADMIN_USER"]);
    expect(resolveAvailable).toHaveBeenNthCalledWith(2, ["ADMIN_USER"]);
  });

  it("maps two keys to the same stored name and resolves both, deduplicating the lookup", async () => {
    const result = await resolveWithAliases(
      ["TOKEN", "API_TOKEN"],
      { TOKEN: "th-12-all-TOKEN", API_TOKEN: "th-12-all-TOKEN" },
      resolveAvailable,
    );
    expect(result).toEqual({ TOKEN: "stored-token", API_TOKEN: "stored-token" });
    expect(resolveAvailable).toHaveBeenCalledTimes(1);
    expect(resolveAvailable).toHaveBeenCalledWith(["th-12-all-TOKEN"]);
  });

  it("with empty aliases, reads every key by its own name", async () => {
    const result = await resolveWithAliases(["ADMIN_USER", "ADMIN_PASSWORD"], {}, resolveAvailable);
    expect(result).toEqual({ ADMIN_USER: "plain-admin" });
    expect(resolveAvailable).toHaveBeenCalledTimes(1);
    expect(resolveAvailable).toHaveBeenCalledWith(["ADMIN_USER", "ADMIN_PASSWORD"]);
  });

  it("with undefined aliases and no keys, returns an empty record without calling the store", async () => {
    const result = await resolveWithAliases([], undefined, resolveAvailable);
    expect(result).toEqual({});
    expect(resolveAvailable).not.toHaveBeenCalled();
  });
});
