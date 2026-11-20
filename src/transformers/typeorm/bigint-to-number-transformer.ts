import { ValueTransformer } from 'typeorm';

// Some drivers return bigint columns as strings. Byte counts stay well below 2^53, so numbers are safe.
export const BigintToNumberTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | number | null) => (value === null || value === undefined ? null : Number(value)),
};
