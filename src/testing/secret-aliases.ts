/**
 * Resolves the secrets a run's scenarios reference, mapping each scenario key through `aliases` to the stored
 * secret key to read. Keys without an alias are read by their own name. Returns a record keyed by the ORIGINAL
 * scenario keys, so the runner sees the names it asked for.
 *
 * A key whose alias is not in the store falls back to resolving its plain key.
 */
export async function resolveWithAliases(
  keys: string[],
  aliases: Record<string, string> | undefined,
  resolveAvailable: (names: string[]) => Promise<Record<string, any>>,
): Promise<Record<string, any>> {
  const requested = Array.from(new Set((keys ?? []).filter(Boolean)));
  if (requested.length === 0) {
    return {};
  }

  const storedNameFor = (key: string): string => {
    const alias = aliases?.[key];
    return typeof alias === 'string' && alias ? alias : key;
  };

  const mappedNames = Array.from(new Set(requested.map(storedNameFor)));
  const resolvedByName = await resolveAvailable(mappedNames);

  const result: Record<string, any> = {};
  const fallbackKeys: string[] = [];
  for (const key of requested) {
    const name = storedNameFor(key);
    if (name in resolvedByName) {
      result[key] = resolvedByName[name];
    } else if (name !== key) {
      fallbackKeys.push(key);
    }
  }

  if (fallbackKeys.length > 0) {
    const resolvedByKey = await resolveAvailable(fallbackKeys);
    for (const key of fallbackKeys) {
      if (key in resolvedByKey) {
        result[key] = resolvedByKey[key];
      }
    }
  }

  return result;
}
