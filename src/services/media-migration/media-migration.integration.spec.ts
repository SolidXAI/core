/**
 * End-to-end checks of the media migration against a real database and real files on disk.
 *
 * Runs only when a Postgres test database is available:
 *   MEDIA_MIGRATION_TEST_PG_PORT=55432 MEDIA_MIGRATION_TEST_PG_HOST=127.0.0.1 npx jest media-migration.integration
 * Without MEDIA_MIGRATION_TEST_PG_PORT the suite is skipped. The database is wiped by the test.
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource, getMetadataArgsStorage } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { Media } from 'src/entities/media.entity';
import { MediaMigrationItem } from 'src/entities/media-migration-item.entity';
import { MediaMigrationJob } from 'src/entities/media-migration-job.entity';
import { MediaStorageProviderMetadata } from 'src/entities/media-storage-provider-metadata.entity';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { FieldMetadata } from 'src/entities/field-metadata.entity';
import { DiskFileService, S3FileService } from 'src/services/file';
import { MediaMigrationRunnerService } from './media-migration-runner.service';
import { MediaMigrationService } from './media-migration.service';
import { MediaTransferService } from './media-transfer.service';

const port = process.env.MEDIA_MIGRATION_TEST_PG_PORT;
const describeIfDb = port ? describe : describe.skip;

const workRoot = path.join(process.cwd(), '.media-migration-it-tmp');
const publicDir = path.join(workRoot, 'media-files-storage');
const privateDir = path.join(workRoot, 'media-files-storage-private');

describeIfDb('media migration end to end', () => {
  let ds: DataSource;
  let runner: MediaMigrationRunnerService;
  let service: MediaMigrationService;
  let publisher: { publish: jest.Mock };
  let publicProvider: MediaStorageProviderMetadata;
  let privateProvider: MediaStorageProviderMetadata;
  let model: ModelMetadata;
  let field: FieldMetadata;

  beforeAll(async () => {
    process.env.AB_MEDIA_FILE_STORAGE_ROOT = workRoot;
    fs.rmSync(workRoot, { recursive: true, force: true });
    fs.mkdirSync(publicDir, { recursive: true });
    fs.mkdirSync(privateDir, { recursive: true });

    // Load every entity so the test schema matches the app's.
    for (const file of fs.readdirSync(path.join(process.cwd(), 'src/entities')).filter(f => f.endsWith('.entity.ts'))) {
      require(path.join(process.cwd(), 'src/entities', file));
    }

    ds = new DataSource({
      type: 'postgres', host: process.env.MEDIA_MIGRATION_TEST_PG_HOST || '127.0.0.1', port: Number(port),
      username: 'postgres', database: 'postgres',
      entities: getMetadataArgsStorage().tables.map(table => table.target as Function) as any,
      namingStrategy: new SnakeNamingStrategy(),
      synchronize: false,
    });
    await ds.initialize();
    await ds.synchronize(true);

    const config = { get: () => undefined } as any;
    const transfer = new MediaTransferService(new DiskFileService(), new S3FileService());
    runner = new MediaMigrationRunnerService(ds, transfer, config);
    publisher = { publish: jest.fn(async () => 'message-id') };
    service = new MediaMigrationService(ds, transfer, config, publisher as any);

    publicProvider = await ds.getRepository(MediaStorageProviderMetadata).save({ name: 'fs-public', type: 'filesystem', isPublic: true } as any) as any;
    privateProvider = await ds.getRepository(MediaStorageProviderMetadata).save({ name: 'fs-private', type: 'filesystem', isPublic: false } as any) as any;
    model = await ds.getRepository(ModelMetadata).save({
      singularName: 'product', pluralName: 'products', displayName: 'Products', dataSource: 'default', dataSourceType: 'postgres',
    } as any) as any;
    field = await ds.getRepository(FieldMetadata).save({ name: 'photo', displayName: 'Photo', type: 'mediaSingle', model } as any) as any;
  });

  afterAll(async () => {
    await ds?.destroy();
    fs.rmSync(workRoot, { recursive: true, force: true });
  });

  const writeSource = (relative: string, content: string) => {
    const full = path.join(publicDir, relative);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  };

  const addRow = (relativeUri: string, entityId: number, provider = publicProvider) =>
    ds.getRepository(Media).save({
      entityId, relativeUri, fileSize: fs.existsSync(path.join(publicDir, relativeUri)) ? fs.statSync(path.join(publicDir, relativeUri)).size : 1,
      mimeType: 'text/plain', originalFileName: relativeUri, modelMetadata: model, fieldMetadata: field, mediaStorageProviderMetadata: provider,
    } as any) as unknown as Promise<Media>;

  const createJob = (overrides: Partial<MediaMigrationJob> = {}) =>
    ds.getRepository(MediaMigrationJob).save({
      sourceProvider: publicProvider, targetProvider: privateProvider, status: 'pending', batchSize: 10, concurrency: 2,
      repointFields: false, overwriteExisting: false, ...overrides,
    } as any) as unknown as Promise<MediaMigrationJob>;

  const rowOn = async (id: number) => ds.getRepository(Media).findOneOrFail({ where: { id }, relations: ['mediaStorageProviderMetadata'], withDeleted: true });
  const jobOf = (id: number) => ds.getRepository(MediaMigrationJob).findOneOrFail({ where: { id } });

  it('moves one entity\'s file to the private provider, moves the shared row with it, and keeps the source', async () => {
    writeSource('alpha.txt', 'alpha');
    const own = await addRow('alpha.txt', 1);
    const other = await addRow('alpha.txt', 99); // a draft/publish version outside the scope
    const untouched = await addRow('beta.txt', 2);
    writeSource('beta.txt', 'beta!');

    const job = await createJob({ entityIds: [1] });
    const result = await runner.run(job.id);

    expect(result.status).toBe('completed');
    expect((await rowOn(own.id)).mediaStorageProviderMetadata.id).toBe(privateProvider.id);
    expect((await rowOn(other.id)).mediaStorageProviderMetadata.id).toBe(privateProvider.id);
    expect((await rowOn(untouched.id)).mediaStorageProviderMetadata.id).toBe(publicProvider.id);
    expect(fs.readFileSync(path.join(privateDir, 'alpha.txt'), 'utf8')).toBe('alpha');
    expect(fs.existsSync(path.join(publicDir, 'alpha.txt'))).toBe(true);

    const finished = await jobOf(job.id);
    expect([finished.totalCount, finished.migratedCount, finished.failedCount, finished.status]).toEqual([1, 1, 0, 'completed']);
    expect(finished.leaseToken).toBeNull();
    const item = await ds.getRepository(MediaMigrationItem).findOneOrFail({ where: { sourceKey: 'alpha.txt' } });
    expect(item.status).toBe('completed');
    expect(item.copied).toBe(true);
    expect(item.mediaIds.sort()).toEqual([own.id, other.id].sort());
  });

  it('cleanup removes the source file only after the copy is checked, and refuses without confirmation', async () => {
    const job = await ds.getRepository(MediaMigrationJob).findOneOrFail({ where: { status: 'completed' }, order: { id: 'DESC' } });
    await expect(service.cleanupSource(job.id, 'yes')).rejects.toThrow(/confirm/);

    const outcome = await service.cleanupSource(job.id, 'DELETE_SOURCE_FILES');
    expect(outcome).toEqual({ deleted: 1, skipped: [] });
    expect(fs.existsSync(path.join(publicDir, 'alpha.txt'))).toBe(false);
    expect(fs.readFileSync(path.join(privateDir, 'alpha.txt'), 'utf8')).toBe('alpha');
  });

  it('rollback moves the rows back to the source when the source file still exists', async () => {
    writeSource('gamma.txt', 'gamma');
    const row = await addRow('gamma.txt', 3);
    const job = await createJob({ entityIds: [3] });
    expect((await runner.run(job.id)).status).toBe('completed');
    expect((await rowOn(row.id)).mediaStorageProviderMetadata.id).toBe(privateProvider.id);

    const { job: rolledBack, targetFilesLeft } = await service.rollback(job.id);
    expect(rolledBack.status).toBe('rolled_back');
    expect(targetFilesLeft).toBe(1);
    expect((await rowOn(row.id)).mediaStorageProviderMetadata.id).toBe(publicProvider.id);
    expect(fs.existsSync(path.join(publicDir, 'gamma.txt'))).toBe(true);
  });

  it('records a missing source file as a failed item, and a retry migrates it once the file is back', async () => {
    const row = await addRow('delta.txt', 4); // the file is not written yet
    const job = await createJob({ entityIds: [4] });

    expect((await runner.run(job.id)).status).toBe('completed_with_errors');
    const failed = await ds.getRepository(MediaMigrationItem).findOneOrFail({ where: { sourceKey: 'delta.txt' } });
    expect([failed.status, failed.errorCode]).toEqual(['failed', 'SOURCE_NOT_FOUND']);
    expect((await rowOn(row.id)).mediaStorageProviderMetadata.id).toBe(publicProvider.id);

    writeSource('delta.txt', 'delta');
    await service.retryFailed(job.id);
    expect(publisher.publish).toHaveBeenCalledWith(expect.objectContaining({ payload: { jobId: job.id } }));
    expect((await runner.run(job.id)).status).toBe('completed');
    expect((await rowOn(row.id)).mediaStorageProviderMetadata.id).toBe(privateProvider.id);
  });

  it('refuses to copy two different files to the same target name within one job', async () => {
    writeSource('epsilon.txt', 'public copy');
    fs.mkdirSync(privateDir, { recursive: true });
    fs.writeFileSync(path.join(privateDir, 'epsilon.txt'), 'a different file');
    const first = await addRow('epsilon.txt', 5);
    const second = await addRow('media-files-storage-private/epsilon.txt', 5);
    const job = await createJob({ entityIds: [5] });

    expect((await runner.run(job.id)).status).toBe('completed_with_errors');
    const items = await ds.getRepository(MediaMigrationItem).find({ where: { job: { id: job.id } } });
    expect(items.map(item => item.status).sort()).toEqual(['completed', 'failed']);
    expect(items.find(item => item.status === 'failed')?.errorCode).toBe('TARGET_KEY_CONFLICT');
    expect(first.id).toBeDefined();
    expect(second.id).toBeDefined();
  });

  it('does not run a job while another worker holds its lease', async () => {
    const job = await createJob({ entityIds: [6] });
    await ds.getRepository(MediaMigrationJob).update({ id: job.id }, { leaseToken: 'someone-else', leaseExpiresAt: new Date(Date.now() + 60_000) });
    expect((await runner.run(job.id)).status).toBe('not_started');
  });

  it('previews the scope and warns about shared rows outside it, without writing anything', async () => {
    writeSource('zeta.txt', 'zeta');
    await addRow('zeta.txt', 8);
    await addRow('zeta.txt', 80); // shared, outside the previewed scope
    const jobsBefore = await ds.getRepository(MediaMigrationJob).count();

    const preview = await service.preview({ sourceProviderId: publicProvider.id, targetProviderId: privateProvider.id, fieldMetadataIds: [field.id], entityIds: [8] });

    expect(preview.totalFiles).toBe(1);
    expect(preview.totalMediaRows).toBe(1);
    expect(preview.totalBytes).toBe(4);
    expect(preview.warnings.join(' ')).toMatch(/1 media row\(s\) outside this scope/);
    expect(await ds.getRepository(MediaMigrationJob).count()).toBe(jobsBefore);
  });

  it('creates and queues a job after checks, and refuses an invalid scope or a second active job', async () => {
    await ds.getRepository(MediaMigrationJob).update({ status: 'pending' }, { status: 'cancelled' });
    writeSource('eta.txt', 'eta');
    await addRow('eta.txt', 9);

    await expect(service.create({ sourceProviderId: publicProvider.id, targetProviderId: publicProvider.id })).rejects.toThrow(/same/);
    await expect(service.create({ sourceProviderId: publicProvider.id, targetProviderId: privateProvider.id, modelMetadataIds: [model.id], fieldMetadataIds: [field.id], entityIds: [9] }))
      .rejects.toThrow(/exactly one model or exactly one field/);

    const job = await service.create({ sourceProviderId: publicProvider.id, targetProviderId: privateProvider.id, fieldMetadataIds: [field.id], entityIds: [9], batchSize: 5000, concurrency: 0 });
    expect(job.status).toBe('pending');
    expect(job.batchSize).toBe(1000);
    expect(job.concurrency).toBe(1);
    expect(publisher.publish).toHaveBeenLastCalledWith(expect.objectContaining({ payload: { jobId: job.id } }));

    await expect(service.create({ sourceProviderId: publicProvider.id, targetProviderId: privateProvider.id, fieldMetadataIds: [field.id], entityIds: [9] }))
      .rejects.toThrow(/already pending/);
  });

  it('cancels a pending job immediately', async () => {
    const job = await createJob({ entityIds: [7] });
    expect((await service.cancel(job.id)).status).toBe('cancelled');
  });
});
