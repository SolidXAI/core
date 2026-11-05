import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { CommonEntity } from 'src/entities/common.entity';
import { MediaMigrationItem } from 'src/entities/media-migration-item.entity';
import { MediaMigrationJob } from 'src/entities/media-migration-job.entity';
import { MediaStorageProviderMetadata } from 'src/entities/media-storage-provider-metadata.entity';

// Keeps the media migration tables and their SolidX metadata (models, views, actions, menus) in step.
const metadata = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-data/solid-core-metadata.json'), 'utf8'));

const models: Record<string, any> = Object.fromEntries(
  metadata.moduleMetadata.models.map((model: any) => [model.singularName, model]),
);
const SYSTEM_COLUMNS = new Set(Object.getOwnPropertyNames(new (class extends CommonEntity { })()).concat([
  'id', 'createdAt', 'updatedAt', 'deletedAt', 'deletedTracker', 'publishedAt', 'isPublished', 'isLatest',
  'initialEntityVersionId', 'publishedTracker', 'localeName', 'defaultEntityLocaleId', 'createdBy', 'updatedBy',
]));

async function entityProperties(entity: Function): Promise<string[]> {
  const ds = new DataSource({ type: 'postgres', entities: [MediaStorageProviderMetadata, MediaMigrationJob, MediaMigrationItem] });
  await (ds as any).buildMetadatas();
  const meta = ds.getMetadata(entity);
  return [...meta.columns.filter(c => !c.relationMetadata).map(c => c.propertyName), ...meta.relations.map(r => r.propertyName)]
    .filter(name => !SYSTEM_COLUMNS.has(name));
}

describe.each([
  ['mediaMigrationJob', MediaMigrationJob, 'ss_media_migration_job'],
  ['mediaMigrationItem', MediaMigrationItem, 'ss_media_migration_item'],
])('%s metadata', (singularName, entity, tableName) => {
  const model = models[singularName];

  it('is defined as a system model on the right table', () => {
    expect(model).toBeDefined();
    expect(model.tableName).toBe(tableName);
    expect(model.isSystem).toBe(true);
  });

  it('declares exactly the fields the entity has', async () => {
    expect(model.fields.map((f: any) => f.name).sort()).toEqual((await entityProperties(entity)).sort());
  });

  it('only shows fields that exist in its list and form views', () => {
    const known = new Set([...model.fields.map((f: any) => f.name), 'id', 'createdAt', 'updatedAt']);
    const views = metadata.views.filter((v: any) => v.modelUserKey === singularName);
    expect(views.map((v: any) => v.type).sort()).toEqual(['form', 'list']);
    const used: string[] = [];
    const walk = (node: any) => {
      if (node.type === 'field') used.push(node.attrs.name);
      (node.children ?? []).forEach(walk);
    };
    views.forEach((v: any) => walk(v.layout));
    expect(used.filter(name => !known.has(name))).toEqual([]);
  });

  it('has a menu that opens a list action on its list view', () => {
    const action = metadata.actions.find((a: any) => a.modelUserKey === singularName);
    expect(action?.viewUserKey).toBe(`${singularName}-list-view`);
    expect(metadata.views.some((v: any) => v.name === action.viewUserKey)).toBe(true);
    const menu = metadata.menus.find((m: any) => m.actionUserKey === action.name);
    expect(menu?.parentMenuItemUserKey).toBe('mediaManagement-menu-item');
  });

  it('is read-only in the admin UI', () => {
    const list = metadata.views.find((v: any) => v.name === `${singularName}-list-view`);
    expect(list.layout.attrs).toMatchObject({ create: false, edit: false, delete: false });
  });
});

describe('media migration relations', () => {
  const field = (model: string, name: string) => models[model].fields.find((f: any) => f.name === name);

  it('points providers at the provider model and keeps them from being removed', () => {
    for (const name of ['sourceProvider', 'targetProvider']) {
      expect(field('mediaMigrationJob', name)).toMatchObject({
        relationType: 'many-to-one', relationCoModelSingularName: 'mediaStorageProviderMetadata', relationCascade: 'restrict', required: true,
      });
    }
  });

  it('links items to their job in both directions', () => {
    expect(field('mediaMigrationItem', 'job')).toMatchObject({
      relationType: 'many-to-one', relationCoModelSingularName: 'mediaMigrationJob', relationCoModelFieldName: 'mediaMigrationItems', relationCascade: 'cascade',
    });
    expect(field('mediaMigrationJob', 'mediaMigrationItems')).toMatchObject({
      relationType: 'one-to-many', relationCoModelSingularName: 'mediaMigrationItem', relationCoModelFieldName: 'job',
    });
  });

  it('lists the same job and file statuses as the entities', () => {
    const values = (model: string) => field(model, 'status').selectionStaticValues.map((v: string) => v.split(':')[0]);
    expect(values('mediaMigrationJob')).toEqual([...require('src/entities/media-migration-job.entity').MEDIA_MIGRATION_JOB_STATUSES]);
    expect(values('mediaMigrationItem')).toEqual([...require('src/entities/media-migration-item.entity').MEDIA_MIGRATION_ITEM_STATUSES]);
  });
});
