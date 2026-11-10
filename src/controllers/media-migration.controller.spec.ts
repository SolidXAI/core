import 'reflect-metadata';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { MediaMigrationController } from './media-migration.controller';
import { CleanupMediaMigrationDto, CreateMediaMigrationDto } from '../dtos/create-media-migration.dto';

const routes = (method: any) => Object.getOwnPropertyNames(method.prototype)
  .filter(name => name !== 'constructor')
  .map(name => ({
    name,
    method: Reflect.getMetadata(METHOD_METADATA, method.prototype[name]) as RequestMethod,
    path: Reflect.getMetadata(PATH_METADATA, method.prototype[name]) as string,
  }));

describe('MediaMigrationController routes', () => {
  const found = routes(MediaMigrationController);
  const has = (method: RequestMethod, path: string) => found.some(route => route.method === method && route.path === path);

  it('exposes every endpoint in the migration spec', () => {
    expect(has(RequestMethod.POST, 'preview')).toBe(true);
    expect(has(RequestMethod.POST, '/')).toBe(true);
    expect(has(RequestMethod.GET, '/')).toBe(true);
    expect(has(RequestMethod.GET, ':id')).toBe(true);
    expect(has(RequestMethod.GET, ':id/items')).toBe(true);
    for (const action of ['cancel', 'resume', 'retry-failed', 'rollback', 'cleanup']) {
      expect(has(RequestMethod.POST, `:id/${action}`)).toBe(true);
    }
  });

  it('gives every method its own name, so the permission check can tell them apart', () => {
    const names = found.map(route => route.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('request bodies', () => {
  const create = (body: Record<string, unknown>) =>
    validateSync(plainToInstance(CreateMediaMigrationDto, body, { enableImplicitConversion: true }));

  it('accepts a whole-provider migration by name', () => {
    expect(create({ sourceProviderName: 'fs-public', targetProviderName: 'aws-main' })).toEqual([]);
  });

  it('accepts numbers sent as text, as multipart and query forms do', () => {
    expect(create({ sourceProviderId: '1', targetProviderId: '3', fieldMetadataIds: ['45', '46'] })).toEqual([]);
  });

  it('rejects a provider id that is not a whole number', () => {
    expect(create({ sourceProviderId: 'abc' }).map(error => error.property)).toContain('sourceProviderId');
  });

  it('rejects a scope list that contains something other than whole numbers', () => {
    expect(create({ fieldMetadataIds: [1, 'x'] }).map(error => error.property)).toContain('fieldMetadataIds');
  });

  it('reads the text "false" for overwriteExisting as false, not true', () => {
    const dto = plainToInstance(CreateMediaMigrationDto, { overwriteExisting: 'false' }, { enableImplicitConversion: true });
    expect(dto.overwriteExisting).toBe(false);
    expect(validateSync(dto)).toEqual([]);
  });

  it('accepts model and field user keys', () => {
    expect(create({ modelUserKeys: ['product'], fieldUserKeys: [{ modelUserKey: 'product', fieldUserKey: 'photo' }] })).toEqual([]);
  });

  it('requires a field user key to name its model, since field names repeat across models', () => {
    const errors = create({ fieldUserKeys: [{ fieldUserKey: 'photo' }] });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a model user key that is not text', () => {
    expect(create({ modelUserKeys: [42] }).map(error => error.property)).toContain('modelUserKeys');
  });

  it('no longer accepts repointFields', () => {
    expect(Object.keys(new CreateMediaMigrationDto())).not.toContain('repointFields');
  });

  it('requires the confirmation text to be given for cleanup', () => {
    const cleanup = plainToInstance(CleanupMediaMigrationDto, {});
    expect(validateSync(cleanup).map(error => error.property)).toContain('confirm');
  });
});
