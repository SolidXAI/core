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
    expect(publisher.publish).toHaveBeenCalledWith(expect.objectContaining({ payload: { jobId: job.id } }), 'MediaMigrationPublisher');
    expect((await runner.run(job.id)).status).toBe('completed');
    expect((await rowOn(row.id)).mediaStorageProviderMetadata.id).toBe(privateProvider.id);
  });

  // A file outside the media folders is stored under its bare file name, so it can share a name with a public one.
  const writeElsewhere = (name: string, content: string) => {
    const dir = path.join(workRoot, 'other');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), content);
    return path.join(dir, name);
  };

  it('refuses to copy two different files to the same target name within one job', async () => {
    writeSource('epsilon.txt', 'public copy');
    const elsewhere = writeElsewhere('epsilon.txt', 'another file');
    await addRow('epsilon.txt', 5);
    await addRow(elsewhere, 5);
    const job = await createJob({ entityIds: [5], concurrency: 1 });

    expect((await runner.run(job.id)).status).toBe('completed_with_errors');
    const items = await ds.getRepository(MediaMigrationItem).find({ where: { job: { id: job.id } } });
    expect(items.map(item => item.status).sort()).toEqual(['completed', 'failed']);
    expect(items.find(item => item.status === 'failed')?.errorCode).toBe('TARGET_KEY_CONFLICT');
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
    expect(publisher.publish).toHaveBeenLastCalledWith(expect.objectContaining({ payload: { jobId: job.id } }), 'MediaMigrationPublisher');

    await expect(service.create({ sourceProviderId: publicProvider.id, targetProviderId: privateProvider.id, fieldMetadataIds: [field.id], entityIds: [9] }))
      .rejects.toThrow(/already pending/);
  });

  it('cancels a pending job immediately', async () => {
    const job = await createJob({ entityIds: [7] });
    expect((await service.cancel(job.id)).status).toBe('cancelled');
  });

  // ---- fixes found in the Phase 3 review ----

  const clearActiveJobs = () =>
    ds.getRepository(MediaMigrationJob).createQueryBuilder().update()
      .set({ status: 'cancelled', leaseToken: null, leaseExpiresAt: null } as any)
      .where("status IN ('pending','running','cancelling')").execute();
  const itemsOf = (jobId: number) => ds.getRepository(MediaMigrationItem).find({ where: { job: { id: jobId } } });

  describe('a same-named file already on the target', () => {
    it('is not trusted just because it has the same size', async () => {
      writeSource('twin-size.txt', 'AAAA');
      fs.writeFileSync(path.join(privateDir, 'twin-size.txt'), 'BBBB');
      const row = await addRow('twin-size.txt', 20);

      const job = await createJob({ entityIds: [20] });
      expect((await runner.run(job.id)).status).toBe('completed_with_errors');
      expect((await itemsOf(job.id))[0]).toMatchObject({ status: 'failed', errorCode: 'TARGET_KEY_CONFLICT' });
      expect((await rowOn(row.id)).mediaStorageProviderMetadata.id).toBe(publicProvider.id);
      expect(fs.readFileSync(path.join(privateDir, 'twin-size.txt'), 'utf8')).toBe('BBBB');

      const overwrite = await createJob({ entityIds: [20], overwriteExisting: true });
      expect((await runner.run(overwrite.id)).status).toBe('completed');
      expect(fs.readFileSync(path.join(privateDir, 'twin-size.txt'), 'utf8')).toBe('AAAA');
      expect((await rowOn(row.id)).mediaStorageProviderMetadata.id).toBe(privateProvider.id);
    });

    it('is accepted without copying when the content is identical', async () => {
      writeSource('same-content.txt', 'CCCC');
      fs.writeFileSync(path.join(privateDir, 'same-content.txt'), 'CCCC');
      const row = await addRow('same-content.txt', 21);

      const job = await createJob({ entityIds: [21] });
      expect((await runner.run(job.id)).status).toBe('completed');
      expect((await itemsOf(job.id))[0]).toMatchObject({ status: 'completed', copied: false });
      expect((await rowOn(row.id)).mediaStorageProviderMetadata.id).toBe(privateProvider.id);
    });
  });

  describe('cleanup', () => {
    it('keeps the source file while a row on another provider that shares the folder still uses it', async () => {
      const sameFolder = await ds.getRepository(MediaStorageProviderMetadata).save({ name: 'fs-public-2', type: 'filesystem', isPublic: true } as any) as any;
      writeSource('shared-folder.txt', 'S');
      await addRow('shared-folder.txt', 22);
      await addRow('shared-folder.txt', 23, sameFolder);

      const job = await createJob({ entityIds: [22] });
      expect((await runner.run(job.id)).status).toBe('completed');

      const outcome = await service.cleanupSource(job.id, 'DELETE_SOURCE_FILES');
      expect(outcome.deleted).toBe(0);
      expect(outcome.skipped[0].reason).toMatch(/still use the source file/);
      expect(fs.existsSync(path.join(publicDir, 'shared-folder.txt'))).toBe(true);
    });

    it('keeps the source file while a row that spells its name differently still uses it', async () => {
      writeSource('alias.txt', 'Z');
      await addRow('alias.txt', 24);
      await addRow('media-files-storage/alias.txt', 24); // the same file on disk, written with the folder prefix

      const job = await createJob({ entityIds: [24] });
      expect((await runner.run(job.id)).status).toBe('completed_with_errors');

      const outcome = await service.cleanupSource(job.id, 'DELETE_SOURCE_FILES');
      expect(outcome.deleted).toBe(0);
      expect(fs.existsSync(path.join(publicDir, 'alias.txt'))).toBe(true);
    });
  });

  it('never lets two files that run at the same time take the same target name', async () => {
    const pairs = Array.from({ length: 10 }, (_, i) => i);
    const winnerContent = new Map<number, string[]>();
    for (const i of pairs) {
      writeSource(`pair${i}.txt`, `public ${i}`);
      const elsewhere = writeElsewhere(`pair${i}.txt`, `elsewhere ${i}`);
      await addRow(`pair${i}.txt`, 40);
      await addRow(elsewhere, 40);
      winnerContent.set(i, [`public ${i}`, `elsewhere ${i}`]);
    }
    const job = await createJob({ entityIds: [40], concurrency: 8, batchSize: 100 });

    expect((await runner.run(job.id)).status).toBe('completed_with_errors');
    const items = await itemsOf(job.id);
    for (const i of pairs) {
      const forPair = items.filter(item => item.sourceKey.endsWith(`pair${i}.txt`));
      expect(forPair.map(item => item.status).sort()).toEqual(['completed', 'failed']);
      expect(forPair.find(item => item.status === 'failed')?.errorCode).toBe('TARGET_KEY_CONFLICT');
      // the target holds exactly one of the two files, intact
      expect(winnerContent.get(i)).toContain(fs.readFileSync(path.join(privateDir, `pair${i}.txt`), 'utf8'));
    }
  });

  it('refuses a file name too long to track, even when it would shorten to a usable target name', async () => {
    const longDir = path.join(workRoot, 'other', ...Array(230).fill('d'));
    fs.mkdirSync(longDir, { recursive: true });
    const longFile = path.join(longDir, 'long.txt');
    fs.writeFileSync(longFile, 'long');
    expect(longFile.length).toBeGreaterThan(450);
    const row = await addRow(longFile, 25);

    const job = await createJob({ entityIds: [25] });
    expect((await runner.run(job.id)).status).toBe('completed_with_errors');
    expect((await itemsOf(job.id))[0]).toMatchObject({ status: 'failed', errorCode: 'INVALID_FILE_KEY' });
    expect((await rowOn(row.id)).mediaStorageProviderMetadata.id).toBe(publicProvider.id);
    expect(fs.existsSync(path.join(privateDir, 'long.txt'))).toBe(false);
  });

  it('changes the rows and the file record together, so they never disagree', async () => {
    writeSource('atomic.txt', 'atomic');
    const row = await addRow('atomic.txt', 26);
    await ds.query(`CREATE OR REPLACE FUNCTION block_atomic_item() RETURNS trigger AS $$
      BEGIN IF NEW.status = 'completed' AND NEW.source_key = 'atomic.txt' THEN RAISE EXCEPTION 'blocked for the test'; END IF; RETURN NEW; END;
      $$ LANGUAGE plpgsql`);
    await ds.query('CREATE TRIGGER block_atomic_item BEFORE UPDATE ON ss_media_migration_item FOR EACH ROW EXECUTE FUNCTION block_atomic_item()');
    try {
      const job = await createJob({ entityIds: [26] });
      expect((await runner.run(job.id)).status).toBe('completed_with_errors');
      // the row did not move without its record saying so
      expect((await rowOn(row.id)).mediaStorageProviderMetadata.id).toBe(publicProvider.id);
      expect((await itemsOf(job.id))[0].status).toBe('failed');

      await ds.query('DROP TRIGGER block_atomic_item ON ss_media_migration_item');
      await service.retryFailed(job.id);
      expect((await runner.run(job.id)).status).toBe('completed');
      expect((await rowOn(row.id)).mediaStorageProviderMetadata.id).toBe(privateProvider.id);
    } finally {
      await ds.query('DROP TRIGGER IF EXISTS block_atomic_item ON ss_media_migration_item');
      await ds.query('DROP FUNCTION IF EXISTS block_atomic_item()');
    }
  });

  it('does not start a job that was cancelled just after its lease was taken', async () => {
    writeSource('late-cancel.txt', 'late');
    const row = await addRow('late-cancel.txt', 27);
    const job = await createJob({ entityIds: [27] });
    const original = (runner as any).loadJob.bind(runner);
    jest.spyOn(runner as any, 'loadJob').mockImplementationOnce(async (id: number) => {
      await ds.getRepository(MediaMigrationJob).update({ id }, { status: 'cancelled' });
      return original(id);
    });

    const result = await runner.run(job.id);

    expect(result.status).toBe('not_started');
    expect((await jobOf(job.id))).toMatchObject({ status: 'cancelled', leaseToken: null });
    expect((await rowOn(row.id)).mediaStorageProviderMetadata.id).toBe(publicProvider.id);
  });

  describe('jobs whose worker is gone or whose message never arrived', () => {
    const expired = () => new Date(Date.now() - 60_000);
    const alive = () => new Date(Date.now() + 60_000);

    beforeEach(() => clearActiveJobs());

    it('cancels a "cancelling" or "running" job at once when no worker holds it', async () => {
      const cancelling = await createJob({ status: 'cancelling', leaseToken: 'dead', leaseExpiresAt: expired() } as any);
      expect((await service.cancel(cancelling.id)).status).toBe('cancelled');

      const running = await createJob({ status: 'running', leaseToken: 'dead', leaseExpiresAt: expired() } as any);
      expect((await service.cancel(running.id)).status).toBe('cancelled');
    });

    it('asks a live worker to stop instead of cancelling under it', async () => {
      const live = await createJob({ status: 'running', leaseToken: 'alive', leaseExpiresAt: alive() } as any);
      expect((await service.cancel(live.id)).status).toBe('cancelling');
    });

    it('resumes a job stuck in "cancelling" and no longer blocks new jobs for the provider', async () => {
      const stuck = await createJob({ status: 'cancelling', leaseToken: 'dead', leaseExpiresAt: expired() } as any);
      publisher.publish.mockClear();

      const resumed = await service.resume(stuck.id);

      expect(resumed).toMatchObject({ status: 'pending', leaseToken: null });
      expect(publisher.publish).toHaveBeenCalledWith(expect.objectContaining({ payload: { jobId: stuck.id } }), 'MediaMigrationPublisher');
    });

    it('queues a pending job again without clearing the lease of a worker that is starting', async () => {
      const pending = await createJob({ status: 'pending', leaseToken: 'starting', leaseExpiresAt: alive() } as any);
      publisher.publish.mockClear();

      await service.resume(pending.id);

      expect(publisher.publish).toHaveBeenCalledTimes(1);
      expect((await jobOf(pending.id)).leaseToken).toBe('starting');
    });

    it('closes a job that could not be queued, so it does not block the provider', async () => {
      writeSource('unqueued.txt', 'u');
      await addRow('unqueued.txt', 28);
      const request = { sourceProviderId: publicProvider.id, targetProviderId: privateProvider.id, fieldMetadataIds: [field.id], entityIds: [28] };
      publisher.publish.mockRejectedValueOnce(new Error('no broker'));

      await expect(service.create(request)).rejects.toThrow(/could not be queued: no broker/);
      const closed = await ds.getRepository(MediaMigrationJob).findOneOrFail({ where: {}, order: { id: 'DESC' } });
      expect(closed.status).toBe('failed');

      expect((await service.create(request)).status).toBe('pending');
    });
  });

  it('reports a file whose result could not be saved, instead of calling the job clean', async () => {
    await clearActiveJobs();
    writeSource('unsaved-1.txt', 'one');
    writeSource('unsaved-2.txt', 'two');
    const rowOne = await addRow('unsaved-1.txt', 29);
    const rowTwo = await addRow('unsaved-2.txt', 29);
    jest.spyOn(runner as any, 'findOrCreateItem').mockRejectedValueOnce(new Error('database blip'));

    const job = await createJob({ entityIds: [29], concurrency: 1 });
    expect((await runner.run(job.id)).status).toBe('completed_with_errors');

    expect((await jobOf(job.id)).warnings?.join(' ')).toMatch(/1 file\(s\) could not be recorded/);
    const moved = [(await rowOn(rowOne.id)), (await rowOn(rowTwo.id))].filter(row => row.mediaStorageProviderMetadata.id === privateProvider.id);
    expect(moved).toHaveLength(1); // the other file was still migrated

    await service.retryFailed(job.id);
    expect((await runner.run(job.id)).status).toBe('completed');
    expect((await rowOn(rowOne.id)).mediaStorageProviderMetadata.id).toBe(privateProvider.id);
    expect((await rowOn(rowTwo.id)).mediaStorageProviderMetadata.id).toBe(privateProvider.id);
  });

  it('previews a provider with more files than a database allows as query parameters', async () => {
    const bulk = await ds.getRepository(MediaStorageProviderMetadata).save({ name: 'fs-bulk', type: 'filesystem', isPublic: true } as any) as any;
    await ds.query(
      `INSERT INTO ss_media (entity_id, relative_uri, file_size, mime_type, original_file_name, model_metadata_id, media_storage_provider_metadata_id, field_metadata_id)
       SELECT g, 'bulk-' || g || '.txt', 1, 'text/plain', 'bulk', $1, $2, $3 FROM generate_series(1, 70000) g`,
      [model.id, bulk.id, field.id],
    );

    const whole = await service.preview({ sourceProviderId: bulk.id, targetProviderId: privateProvider.id });
    expect(whole.totalFiles).toBe(70000);
    expect(whole.warnings.join(' ')).not.toMatch(/outside this scope/);

    const scoped = await service.preview({ sourceProviderId: bulk.id, targetProviderId: privateProvider.id, fieldMetadataIds: [field.id] });
    expect(scoped.totalFiles).toBe(70000);
  }, 120_000);
});
