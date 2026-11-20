export const SETTINGS_KEY_SEPARATOR = ':';

export const SETTINGS_NAMESPACE_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/;

export function validateSettingNamespace(namespace: string): void {
  if (!SETTINGS_NAMESPACE_PATTERN.test(namespace)) {
    throw new Error(
      `Invalid settings provider namespace "${namespace}". ` +
      'Use lowercase letters, digits, hyphens, and optional dot-separated segments.',
    );
  }
}

export function validateLocalSettingKey(localKey: string): void {
  if (!localKey?.trim()) {
    throw new Error('A namespaced setting must have a non-empty local key.');
  }

  if (localKey.includes(SETTINGS_KEY_SEPARATOR)) {
    throw new Error(
      `Local setting key "${localKey}" must not contain "${SETTINGS_KEY_SEPARATOR}".`,
    );
  }
}

export function buildSettingKey(namespace: string, localKey: string): string {
  validateSettingNamespace(namespace);
  validateLocalSettingKey(localKey);
  return `${namespace}${SETTINGS_KEY_SEPARATOR}${localKey}`;
}
