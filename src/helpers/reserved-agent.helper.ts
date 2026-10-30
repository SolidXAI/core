export const RESERVED_AGENT_NAME = 'solidx-native';
export const RESERVED_AGENT_MODULE = 'solid-core';

export function isReservedAgent(name?: string | null): boolean {
  return name === RESERVED_AGENT_NAME;
}
