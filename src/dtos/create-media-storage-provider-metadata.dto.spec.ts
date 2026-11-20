import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateMediaStorageProviderMetadataDto } from './create-media-storage-provider-metadata.dto';

// Mirrors the app's global ValidationPipe settings (see bootstrap.helper.ts).
const toDto = (payload: Record<string, unknown>) =>
  plainToInstance(CreateMediaStorageProviderMetadataDto, payload, { enableImplicitConversion: true });

describe('CreateMediaStorageProviderMetadataDto isPublic', () => {
  const base = { name: 'p', type: 'filesystem' };

  it('reads the text "false" from a multipart form as false, not true', () => {
    expect(toDto({ ...base, isPublic: 'false' }).isPublic).toBe(false);
  });

  it('reads the text "true" as true', () => {
    expect(toDto({ ...base, isPublic: 'true' }).isPublic).toBe(true);
  });

  it('keeps real booleans from a JSON body', () => {
    expect(toDto({ ...base, isPublic: false }).isPublic).toBe(false);
    expect(toDto({ ...base, isPublic: true }).isPublic).toBe(true);
  });

  it('treats a blank field as not sent', () => {
    const dto = toDto({ ...base, isPublic: '' });
    expect(dto.isPublic).toBeUndefined();
    expect(validateSync(dto)).toEqual([]);
  });

  it('still rejects text that is not a boolean', () => {
    expect(validateSync(toDto({ ...base, isPublic: 'maybe' })).map(e => e.property)).toContain('isPublic');
  });
});
