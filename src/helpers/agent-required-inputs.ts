import { BadRequestException } from '@nestjs/common';

const DATA_TYPES = new Set(['string', 'number', 'integer', 'boolean', 'date', 'datetime', 'object', 'array']);

/** Keep the stored JSON contract consistent with the AgentHub runtime; accept historical aliases. */
export function normalizeAgentRequiredInputs(value: unknown): string {
  try {
    let definitions: any = typeof value === 'string' ? JSON.parse(value) : value;
    if (definitions == null) definitions = [];
    if (!Array.isArray(definitions) && typeof definitions === 'object') {
      definitions = Object.entries(definitions).map(([name, definition]) => ({ name, ...(definition as object) }));
    }
    if (!Array.isArray(definitions)) throw new Error('Required inputs must be an array.');
    const names = new Set<string>();
    const normalized = definitions.map((definition: any) => {
      if (!definition || typeof definition !== 'object' || Array.isArray(definition)) throw new Error('Invalid input definition.');
      const name = String(definition.name ?? definition.variableName ?? '').trim();
      const dataType = definition.dataType ?? definition.type ?? 'string';
      if (!name || names.has(name.toLowerCase()) || ['__proto__', 'constructor', 'prototype'].includes(name)) {
        throw new Error('Each input must have a unique, valid name.');
      }
      if (!DATA_TYPES.has(dataType)) throw new Error(`Unsupported input data type: ${dataType}`);
      names.add(name.toLowerCase());
      return { name, description: String(definition.description ?? '').trim(), dataType };
    });
    return JSON.stringify(normalized);
  } catch (error) {
    throw new BadRequestException(error instanceof Error ? error.message : 'Invalid requiredInputs JSON.');
  }
}
