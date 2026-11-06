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

  // Each test keeps its media in its own field (named by a number), so a job scoped to that field
  // sees only that test's rows.
  const fieldsByKey = new Map<number, FieldMetadata>();
  const fieldFor = async (key: number): Promise<FieldMetadata> => {
    let existing = fieldsByKey.get(key);
    if (!existing) {
      existing = await ds.getRepository(FieldMetadata).save({ name: `testField${key}`, displayName: `Test field ${key}`, type: 'mediaSingle', model } as any) as unknown as FieldMetadata;
      fieldsByKey.set(key, existing);
    }
    return existing;
  };
  const inField = async (key: number) => ({ fieldMetadataIds: [(await fieldFor(key)).id] });

  const addRow = async (relativeUri: string, key: number, provider = publicProvider) =>
    ds.getRepository(Media).save({
      entityId: key, relativeUri, fileSize: fs.existsSync(path.join(publicDir, relativeUri)) ? fs.statSync(path.join(publicDir, relativeUri)).size : 1,
      mimeType: 'text/plain', originalFileName: relativeUri, modelMetadata: model, fieldMetadata: await fieldFor(key), mediaStorageProviderMetadata: provider,
    } as any) as unknown as Media;

  const createJob = (overrides: Partial<MediaMigrationJob> = {}) =>
    ds.getRepository(MediaMigrationJob).save({
      sourceProvider: publicProvider, targetProvider: privateProvider, status: 'pending', batchSize: 10, concurrency: 2,
      overwriteExisting: false, ...overrides,
    } as any) as unknown as Promise<MediaMigrationJob>;

  const rowOn = async (id: number) => ds.getRepository(Media).findOneOrFail({ where: { id }, relations: ['mediaStorageProviderMetadata'], withDeleted: true });
  const jobOf = (id: number) => ds.getRepository(MediaMigrationJob).findOneOrFail({ where: { id } });

  it('moves one field\'s file to the private provider, moves the shared row with it, and keeps the source', async () => {
    writeSource('alpha.txt', 'alpha');
    const own = await addRow('alpha.txt', 1);
    const other = await addRow('alpha.txt', 99); // a row in another field (such as a draft/publish version) that uses the same file
    const untouched = await addRow('beta.txt', 2);
    writeSource('beta.txt', 'beta!');

    const job = await createJob(await inField(1));
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
    const job = await createJob(await inField(3));
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
    const job = await createJob(await inField(4));

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
    const job = await createJob({ ...(await inField(5)), concurrency: 1 });

    expect((await runner.run(job.id)).status).toBe('completed_with_errors');
    const items = await ds.getRepository(MediaMigrationItem).find({ where: { job: { id: job.id } } });
    expect(items.map(item => item.status).sort()).toEqual(['completed', 'failed']);
    expect(items.find(item => item.status === 'failed')?.errorCode).toBe('TARGET_KEY_CONFLICT');
  });

  it('does not run a job while another worker holds its lease', async () => {
    const job = await createJob(await inField(6));
    await ds.getRepository(MediaMigrationJob).update({ id: job.id }, { leaseToken: 'someone-else', leaseExpiresAt: new Date(Date.now() + 60_000) });
    expect((await runner.run(job.id)).status).toBe('not_started');
  });

  it('previews the scope and warns about shared rows outside it, without writing anything', async () => {
    writeSource('zeta.txt', 'zeta');
    await addRow('zeta.txt', 8);
    await addRow('zeta.txt', 80); // shared, outside the previewed scope
    const jobsBefore = await ds.getRepository(MediaMigrationJob).count();

    const preview = await service.preview({ sourceProviderId: publicProvider.id, targetProviderId: privateProvider.id, fieldMetadataIds: [(await fieldFor(8)).id] });

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
    await expect(service.create({ sourceProviderId: publicProvider.id, targetProviderId: privateProvider.id, fieldMetadataIds: [999999] }))
      .rejects.toThrow(/do not exist/);

    const job = await service.create({ sourceProviderId: publicProvider.id, targetProviderId: privateProvider.id, fieldMetadataIds: [(await fieldFor(9)).id], batchSize: 5000, concurrency: 0 });
    expect(job.status).toBe('pending');
    expect(job.batchSize).toBe(1000);
    expect(job.concurrency).toBe(1);
    expect(publisher.publish).toHaveBeenLastCalledWith(expect.objectContaining({ payload: { jobId: job.id } }), 'MediaMigrationPublisher');

    await expect(service.create({ sourceProviderId: publicProvider.id, targetProviderId: privateProvider.id, fieldMetadataIds: [(await fieldFor(9)).id] }))
      .rejects.toThrow(/already pending/);
  });

  it('refuses the removed entityIds option instead of quietly migrating the whole field', async () => {
    const request = { sourceProviderId: publicProvider.id, targetProviderId: privateProvider.id, fieldMetadataIds: [(await fieldFor(9)).id], entityIds: [1] } as any;
    await expect(service.preview(request)).rejects.toThrow(/entityIds is no longer supported/);
    await expect(service.create(request)).rejects.toThrow(/entityIds is no longer supported/);
  });

  it('cancels a pending job immediately', async () => {
    const job = await createJob(await inField(7));
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

      const job = await createJob(await inField(20));
      expect((await runner.run(job.id)).status).toBe('completed_with_errors');
      expect((await itemsOf(job.id))[0]).toMatchObject({ status: 'failed', errorCode: 'TARGET_KEY_CONFLICT' });
      expect((await rowOn(row.id)).mediaStorageProviderMetadata.id).toBe(publicProvider.id);
      expect(fs.readFileSync(path.join(privateDir, 'twin-size.txt'), 'utf8')).toBe('BBBB');

      const overwrite = await createJob({ ...(await inField(20)), overwriteExisting: true });
      expect((await runner.run(overwrite.id)).status).toBe('completed');
      expect(fs.readFileSync(path.join(privateDir, 'twin-size.txt'), 'utf8')).toBe('AAAA');
      expect((await rowOn(row.id)).mediaStorageProviderMetadata.id).toBe(privateProvider.id);
    });

    it('is accepted without copying when the content is identical', async () => {
      writeSource('same-content.txt', 'CCCC');
      fs.writeFileSync(path.join(privateDir, 'same-content.txt'), 'CCCC');
      const row = await addRow('same-content.txt', 21);

      const job = await createJob(await inField(21));
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

      const job = await createJob(await inField(22));
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

      const job = await createJob(await inField(24));
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
    const job = await createJob({ ...(await inField(40)), concurrency: 8, batchSize: 100 });

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

    const job = await createJob(await inField(25));
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
      const job = await createJob(await inField(26));
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
    const job = await createJob(await inField(27));
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
      const request = { sourceProviderId: publicProvider.id, targetProviderId: privateProvider.id, fieldMetadataIds: [(await fieldFor(28)).id] };
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

    const job = await createJob({ ...(await inField(29)), concurrency: 1 });
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


  // ---- fields are reported, never changed ----

  describe('media fields still on the old provider', () => {
    const fieldOn = (name: string, provider: MediaStorageProviderMetadata, isSystem = false) =>
      ds.getRepository(FieldMetadata).save({ name, displayName: name, type: 'mediaSingle', model, mediaStorageProvider: provider, isSystem } as any) as unknown as Promise<FieldMetadata>;

    it('lists the source-provider fields in the preview, and leaves fields on the target out', async () => {
      await clearActiveJobs();
      const onSource = await fieldOn('reportOnSource', publicProvider);
      await fieldOn('reportOnTarget', privateProvider);

      const preview = await service.preview({ sourceProviderId: publicProvider.id, targetProviderId: privateProvider.id, fieldMetadataIds: [onSource.id] });

      expect(preview.fieldsOnSourceProvider.map(field => field.name)).toEqual(['reportOnSource']);
      expect(preview.fieldsOnSourceProvider[0]).toMatchObject({ modelName: 'product', isSystem: false });
    });

    it('warns on a completed job that the fields still need linking to the new provider', async () => {
      await clearActiveJobs();
      writeSource('report-a.txt', 'a');
      const photo = await fieldOn('reportWarn', publicProvider);
      await ds.getRepository(Media).save({ entityId: 80, relativeUri: 'report-a.txt', fileSize: 1, mimeType: 'text/plain', originalFileName: 'a', modelMetadata: model, fieldMetadata: photo, mediaStorageProviderMetadata: publicProvider } as any);

      const job = await createJob({ fieldMetadataIds: [photo.id] });
      expect((await runner.run(job.id)).status).toBe('completed');

      const warnings = (await jobOf(job.id)).warnings?.join(' ') ?? '';
      expect(warnings).toMatch(/still store new uploads on "fs-public": product\.reportWarn/);
      expect(warnings).toMatch(/Link them to "fs-private"/);
      expect(warnings).not.toMatch(/system fields/);
    });

    it('adds the system-field note when a listed field is a system field', async () => {
      await clearActiveJobs();
      writeSource('report-b.txt', 'b');
      const system = await fieldOn('reportSystem', publicProvider, true);
      await ds.getRepository(Media).save({ entityId: 81, relativeUri: 'report-b.txt', fileSize: 1, mimeType: 'text/plain', originalFileName: 'b', modelMetadata: model, fieldMetadata: system, mediaStorageProviderMetadata: publicProvider } as any);

      const job = await createJob({ fieldMetadataIds: [system.id] });
      expect((await runner.run(job.id)).status).toBe('completed');
      expect((await jobOf(job.id)).warnings?.join(' ')).toMatch(/system fields set by the package metadata/);
    });

    it('does not change any field when a job runs or is rolled back', async () => {
      await clearActiveJobs();
      writeSource('report-c.txt', 'c');
      const photo = await fieldOn('reportUnchanged', publicProvider);
      await ds.getRepository(Media).save({ entityId: 82, relativeUri: 'report-c.txt', fileSize: 1, mimeType: 'text/plain', originalFileName: 'c', modelMetadata: model, fieldMetadata: photo, mediaStorageProviderMetadata: publicProvider } as any);

      const job = await createJob({ fieldMetadataIds: [photo.id] });
      await runner.run(job.id);
      await service.rollback(job.id);

      const after = await ds.getRepository(FieldMetadata).findOneOrFail({ where: { id: photo.id }, relations: ['mediaStorageProvider'] });
      expect(after.mediaStorageProvider.id).toBe(publicProvider.id);
    });
  });

  it('honours a cancel that arrives after the last batch was checked', async () => {
    await clearActiveJobs();
    writeSource('late-final.txt', 'late');
    const photo = await fieldOn2('lateFinal');
    const row = await ds.getRepository(Media).save({ entityId: 83, relativeUri: 'late-final.txt', fileSize: 4, mimeType: 'text/plain', originalFileName: 'late', modelMetadata: model, fieldMetadata: photo, mediaStorageProviderMetadata: publicProvider } as any);
    const job = await createJob({ fieldMetadataIds: [photo.id] });

    const original = (runner as any).refreshCounts.bind(runner);
    let calls = 0;
    jest.spyOn(runner as any, 'refreshCounts').mockImplementation(async (...args: any[]) => {
      calls += 1;
      const result = await original(...args);
      if (calls === 2) {
        // The second refresh is the one after the last batch; a cancel arrives right here.
        await ds.getRepository(MediaMigrationJob).update({ id: job.id }, { status: 'cancelling' });
      }
      return result;
    });

    try {
      expect((await runner.run(job.id)).status).toBe('cancelled');
      expect((await jobOf(job.id)).status).toBe('cancelled');
    } finally {
      jest.restoreAllMocks();
    }
    expect((await rowOn(row.id)).mediaStorageProviderMetadata.id).toBe(privateProvider.id);
  });

  const fieldOn2 = (name: string) =>
    ds.getRepository(FieldMetadata).save({ name, displayName: name, type: 'mediaSingle', model, mediaStorageProvider: publicProvider } as any) as unknown as Promise<FieldMetadata>;

  // ---- error codes and run behaviour that had no test ----

  it('skips a file whose rows are deleted during the copy, and removes the copy it made', async () => {
    await clearActiveJobs();
    writeSource('vanishing.txt', 'gone soon');
    await addRow('vanishing.txt', 90);
    const transfer = (runner as any).transfer as MediaTransferService;
    const realCopy = transfer.copy.bind(transfer);
    jest.spyOn(transfer, 'copy').mockImplementationOnce(async (source, target, options) => {
      await realCopy(source, target, options);
      await ds.getRepository(Media).delete({ relativeUri: 'vanishing.txt' });
    });

    const job = await createJob(await inField(90));
    expect((await runner.run(job.id)).status).toBe('completed');

    const [item] = await itemsOf(job.id);
    expect([item.status, item.errorCode]).toEqual(['skipped', 'ROW_DELETED_DURING_MIGRATION']);
    expect(fs.existsSync(path.join(privateDir, 'vanishing.txt'))).toBe(false);
    jest.restoreAllMocks();
  });

  it('refuses an S3 provider that has no bucket, before any work starts', async () => {
    const previous = { key: process.env.S3_AWS_ACCESS_KEY, secret: process.env.S3_AWS_SECRET_KEY };
    process.env.S3_AWS_ACCESS_KEY = 'test';
    process.env.S3_AWS_SECRET_KEY = 'test';
    try {
      const noBucket = await ds.getRepository(MediaStorageProviderMetadata).save({ name: 's3-no-bucket', type: 'aws-s3', region: 'ap-south-1' } as any) as any;
      await expect(service.preview({ sourceProviderId: publicProvider.id, targetProviderId: noBucket.id })).rejects.toThrow(/has no bucketName set/);
    } finally {
      if (previous.key === undefined) delete process.env.S3_AWS_ACCESS_KEY; else process.env.S3_AWS_ACCESS_KEY = previous.key;
      if (previous.secret === undefined) delete process.env.S3_AWS_SECRET_KEY; else process.env.S3_AWS_SECRET_KEY = previous.secret;
    }
  });

  it('counts a file that spans several batches once, and moves all of its rows', async () => {
    await clearActiveJobs();
    writeSource('spanning.txt', 'span');
    for (let i = 0; i < 12; i++) {
      await addRow('spanning.txt', 91);
    }
    const job = await createJob({ ...(await inField(91)), batchSize: 10 });
    expect((await runner.run(job.id)).status).toBe('completed');

    const finished = await jobOf(job.id);
    expect([finished.totalCount, finished.migratedCount]).toEqual([1, 1]);
    const [item] = await itemsOf(job.id);
    expect(item.mediaIds).toHaveLength(12);
    const rows = await ds.getRepository(Media).find({ where: { relativeUri: 'spanning.txt' }, relations: ['mediaStorageProviderMetadata'] });
    expect(rows.every(row => row.mediaStorageProviderMetadata.id === privateProvider.id)).toBe(true);
  });

  it('continues from the saved point after a stop, without redoing earlier files', async () => {
    await clearActiveJobs();
    writeSource('resume-1.txt', '1');
    writeSource('resume-2.txt', '2');
    writeSource('resume-3.txt', '3');
    const first = await addRow('resume-1.txt', 92);
    const second = await addRow('resume-2.txt', 92);
    const third = await addRow('resume-3.txt', 92);
    const job = await createJob({ ...(await inField(92)), batchSize: 10, status: 'pending', lastProcessedMediaId: first.id });

    expect((await runner.run(job.id)).status).toBe('completed');

    expect((await rowOn(first.id)).mediaStorageProviderMetadata.id).toBe(publicProvider.id);
    expect((await rowOn(second.id)).mediaStorageProviderMetadata.id).toBe(privateProvider.id);
    expect((await rowOn(third.id)).mediaStorageProviderMetadata.id).toBe(privateProvider.id);
  });

  it('finishes a job whose run failed part way, once it is resumed', async () => {
    await clearActiveJobs();
    writeSource('interrupted-1.txt', 'i1');
    writeSource('interrupted-2.txt', 'i2');
    const one = await addRow('interrupted-1.txt', 93);
    const two = await addRow('interrupted-2.txt', 93);
    const job = await createJob({ ...(await inField(93)), batchSize: 1 });

    // The run stops with an error after the first batch, as if the process had failed.
    const original = (runner as any).processBatches.bind(runner);
    let calls = 0;
    jest.spyOn(runner as any, 'processBatches').mockImplementation(async (...args: any[]) => {
      calls += 1;
      if (calls === 1) {
        const context = args[0];
        const rows = await ds.getRepository(Media).find({ where: { id: one.id }, relations: ['mediaStorageProviderMetadata'] });
        await (runner as any).migrateFile(context, 'interrupted-1.txt', rows);
        await ds.getRepository(MediaMigrationJob).update({ id: job.id }, { lastProcessedMediaId: one.id });
        throw new Error('simulated failure');
      }
      return original(...args);
    });

    expect((await runner.run(job.id)).status).toBe('failed');
    expect((await jobOf(job.id)).status).toBe('failed');

    await service.resume(job.id);
    expect((await runner.run(job.id)).status).toBe('completed');
    expect((await rowOn(one.id)).mediaStorageProviderMetadata.id).toBe(privateProvider.id);
    expect((await rowOn(two.id)).mediaStorageProviderMetadata.id).toBe(privateProvider.id);
    jest.restoreAllMocks();
  });

  // ---- scoping by user key ----

  describe('scoping by user key', () => {
    it('a model userKey (its singularName) selects the same files as its id', async () => {
      const byId = await service.preview({ sourceProviderId: publicProvider.id, targetProviderId: privateProvider.id, modelMetadataIds: [model.id] });
      const byKey = await service.preview({ sourceProviderId: publicProvider.id, targetProviderId: privateProvider.id, modelUserKeys: ['product'] });
      expect(byKey.totalFiles).toBe(byId.totalFiles);
      expect(byKey.totalMediaRows).toBe(byId.totalMediaRows);
    });

    it('a field userKey is qualified by its model, so a field name that repeats picks the right field', async () => {
      const warehouse = await ds.getRepository(ModelMetadata).save({ singularName: 'warehouse', pluralName: 'warehouses', displayName: 'Warehouses', dataSource: 'default', dataSourceType: 'postgres' } as any) as any;
      await ds.getRepository(FieldMetadata).save([
        { name: 'sharedName', displayName: 'Shared', type: 'mediaSingle', model, mediaStorageProvider: publicProvider },
        { name: 'sharedName', displayName: 'Shared', type: 'mediaSingle', model: warehouse, mediaStorageProvider: publicProvider },
      ] as any);

      const preview = await service.preview({
        sourceProviderId: publicProvider.id, targetProviderId: privateProvider.id,
        fieldUserKeys: [{ modelUserKey: 'warehouse', fieldUserKey: 'sharedName' }],
      });
      expect(preview.fieldsOnSourceProvider).toHaveLength(1);
      expect(preview.fieldsOnSourceProvider[0]).toMatchObject({ name: 'sharedName', modelName: 'warehouse' });
    });

    it('refuses an unknown model or field userKey by name, instead of migrating less', async () => {
      await expect(service.preview({ sourceProviderId: publicProvider.id, targetProviderId: privateProvider.id, modelUserKeys: ['no-such-model'] }))
        .rejects.toThrow(/Unknown model userKey: "no-such-model"/);
      await expect(service.preview({ sourceProviderId: publicProvider.id, targetProviderId: privateProvider.id, fieldUserKeys: [{ modelUserKey: 'product', fieldUserKey: 'noSuchField' }] }))
        .rejects.toThrow(/Unknown field userKey "noSuchField" on model "product"/);
    });

    it('combines ids and user keys into one scope', async () => {
      const both = await service.preview({
        sourceProviderId: publicProvider.id, targetProviderId: privateProvider.id,
        modelMetadataIds: [model.id], modelUserKeys: ['product'],
      });
      const byId = await service.preview({ sourceProviderId: publicProvider.id, targetProviderId: privateProvider.id, modelMetadataIds: [model.id] });
      expect(both.totalFiles).toBe(byId.totalFiles);
    });
  });
});
