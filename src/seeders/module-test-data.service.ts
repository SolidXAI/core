import { Injectable, Logger } from '@nestjs/common';
import { DiscoveryService, ModuleRef } from '@nestjs/core';
import { getDataSourceToken } from '@nestjs/typeorm';
import { classify } from '../helpers/string.helper';
import { DataSource, EntityManager } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

import solidCoreMetadata from './seed-data/solid-core-metadata.json';
import { CreateModuleMetadataDto } from 'src/dtos/create-module-metadata.dto';
import { CreateModelMetadataDto } from 'src/dtos/create-model-metadata.dto';
import { MediaStorageProviderType } from 'src/dtos/create-media-storage-provider-metadata.dto';
import { getDynamicModuleNamesBasedOnMetadata } from 'src/helpers/module.helper';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { MediaRepository } from 'src/repository/media.repository';
import { PermissionMetadataRepository } from 'src/repository/permission-metadata.repository';
import { AuthenticationService } from 'src/services/authentication.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { RoleMetadataService } from 'src/services/role-metadata.service';
import { UserService } from 'src/services/user.service';
import { getMediaStorageProvider } from 'src/services/mediaStorageProviders';
import { TestingRoleSpec, TestingUserSpec } from 'src/testing/contracts/testing-metadata.types';

@Injectable()
export class ModuleTestDataService {
  private readonly logger = new Logger(ModuleTestDataService.name);
  private static readonly TEARDOWN_RETRY_ATTEMPTS = 5;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly discoveryService: DiscoveryService,
    private readonly solidRegistry: SolidRegistry,
  ) {}

  async setupTestData(modulesToTest?: string[]): Promise<void> {
    const testDataFiles = this.testDataFiles;
    const filteredFiles = modulesToTest?.length ? testDataFiles.filter((file) => modulesToTest.includes(file.moduleMetadata?.name)) : testDataFiles;

    if (filteredFiles.length === 0) {
      this.logger.warn('No modules matched the provided modulesToTest list.');
      console.log('No modules matched the provided modulesToTest list.');
      return;
    }

    for (const overallMetadata of filteredFiles) {
      const moduleName = overallMetadata?.moduleMetadata?.name ?? 'unknown';
      this.logger.log(`Processing test data for module: ${moduleName}`);
      console.log(`Processing test data for module: ${moduleName}`);
      await this.seedTestData(overallMetadata);
      console.log(`✔ Test data setup complete for module: ${moduleName}`);
    }
  }

  async createTestDatasources(): Promise<void> {
    const manifestPath = path.join(process.cwd(), '.solidx-test-manifest');
    if (fs.existsSync(manifestPath)) {
      console.log('Existing .solidx-test-manifest found; skipping test datasource creation.');
      return;
    }

    const dbRunName = this.generateDbRunName();
    const timestamp = this.getTimestamp();
    const envPath = path.join(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) {
      throw new Error(`Base .env file not found at ${envPath}`);
    }

    const datasourceNames = this.solidRegistry
      .getSolidDatabaseModules()
      .map((wrapper) => wrapper.instance?.name?.())
      .filter(Boolean)
      .map((name) => name.toLowerCase()) as string[];

    if (datasourceNames.length === 0) {
      throw new Error('No solid database modules registered; cannot create test datasources.');
    }

    const dbNameByDatasource = new Map<string, string>();
    for (const dsName of datasourceNames) {
      dbNameByDatasource.set(dsName, `${dsName}_${timestamp}_${dbRunName}`);
    }

    const newEnvContents = this.buildTestEnvContents(
      fs.readFileSync(envPath, 'utf-8'),
      dbNameByDatasource,
    );

    const backupEnvPath = path.join(process.cwd(), `.env.backup.${dbRunName}`);
    fs.copyFileSync(envPath, backupEnvPath);
    fs.writeFileSync(envPath, newEnvContents);
    console.log(`Backed up .env to ${path.basename(backupEnvPath)} and applied new test datasource names to .env.`);

    this.updateTestManifest(dbRunName, timestamp, dbNameByDatasource);

    await this.createTestDatabaseObjects(dbNameByDatasource);

    const dbList = Array.from(dbNameByDatasource.entries())
      .map(([dsName, dbName]) => `- ${dsName}: ${dbName}`)
      .join('\n');

    const instructions = [
      '',
      '============================================================',
      '  TEST DATASOURCE ENVIRONMENT CREATED',
      '------------------------------------------------------------',
      `  Run name : ${dbRunName}`,
      `  Env backup : ${path.basename(backupEnvPath)}`,
      '',
      '  Test databases/schemas created:',
      dbList || '  (none)',
      '',
      '  Next steps:',
      '  1) Using updated .env with test datasource names',
      '  2) Run solid seed as usual',
      '  3) Proceed with the next steps in the workflow',
      '============================================================',
      '',
    ].join('\n');

    console.log(instructions);
  }

  async deleteTestDatasources(): Promise<void> {
    const manifestPath = path.join(process.cwd(), '.solidx-test-manifest');
    if (!fs.existsSync(manifestPath)) {
      this.logger.log('No .solidx-test-manifest found; nothing to delete.');
      console.log('No .solidx-test-manifest found; nothing to delete.');
      return;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as {
      runs?: Record<string, { databases?: Record<string, string>; createdAt?: string }>;
    };
    const runs = manifest?.runs ?? {};
    const runNames = Object.keys(runs);
    if (runNames.length === 0) {
      fs.unlinkSync(manifestPath);
      return;
    }

    const latestRunName = runNames
      .slice()
      .sort((a, b) => {
        const aCreated = runs[a]?.createdAt ?? '';
        const bCreated = runs[b]?.createdAt ?? '';
        return aCreated.localeCompare(bCreated);
      })
      .pop();
    if (latestRunName) {
      const backupEnvPath = path.join(process.cwd(), `.env.backup.${latestRunName}`);
      if (fs.existsSync(backupEnvPath)) {
        fs.copyFileSync(backupEnvPath, path.join(process.cwd(), '.env'));
        console.log(`Restored .env from ${path.basename(backupEnvPath)}.`);
        fs.unlinkSync(backupEnvPath);
      }
    }

    for (const runName of runNames) {
      const envFileName = `.env.${runName}`;
      const envPath = path.join(process.cwd(), envFileName);
      if (fs.existsSync(envPath)) {
        fs.unlinkSync(envPath);
      }
    }

    for (const runName of runNames) {
      const databases = runs[runName]?.databases ?? {};
      await this.dropTestDatabaseObjects(databases);
    }

    fs.unlinkSync(manifestPath);
    console.log('✔ Test datasource env files and manifest deleted; test databases dropped.');
  }

  private get testDataFiles(): any[] {
    const typedSolidCoreMetadata = structuredClone(solidCoreMetadata);
    const testDataFiles = [typedSolidCoreMetadata];
    const enabledModules = getDynamicModuleNamesBasedOnMetadata();
    for (const enabledModule of enabledModules) {
      const enabledModuleSeedFile = `module-metadata/${enabledModule}/${enabledModule}-metadata.json`;
      const fullPath = path.join(process.cwd(), enabledModuleSeedFile);

      if (fs.existsSync(fullPath)) {
        const overallMetadata = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        testDataFiles.push(overallMetadata);
      }
    }

    return testDataFiles;
  }

  private async seedTestData(overallMetadata: any): Promise<void> {
    const moduleMetadata: CreateModuleMetadataDto = overallMetadata.moduleMetadata;
    if (!moduleMetadata) {
      throw new Error('Module metadata missing from test data payload.');
    }

    // console.log(JSON.stringify(moduleMetadata, null, 2));

    const testingRoles: TestingRoleSpec[] = overallMetadata?.testing?.roles ?? [];
    const testingUsers: TestingUserSpec[] = overallMetadata?.testing?.users ?? [];
    const testingData: Array<{ modelUserKey: string; data: Record<string, any> }> = overallMetadata?.testing?.data ?? [];

    if (testingRoles.length > 0) {
      await this.seedTestRoles(testingRoles);
    }
    if (testingUsers.length > 0) {
      await this.seedTestUsers(testingUsers);
    }

    if (testingData.length === 0) {
      this.logger.debug(`No test data found for ${moduleMetadata.name}`);
      return;
    }

    const modelsByName = new Map<string, CreateModelMetadataDto>(
      (moduleMetadata.models ?? []).map((m) => [m.singularName, m]),
    );

    for (const entry of testingData) {
      const modelUserKey = entry.modelUserKey;
      const modelDef = modelsByName.get(modelUserKey);
      if (!modelDef) {
        throw new Error(`Test data modelUserKey not found in metadata: ${modelUserKey}`);
      }

      const entityRepo = this.resolveRepository(modelUserKey);
      const payload: Record<string, any> = { ...(entry.data ?? {}) };

      for (const field of modelDef.fields ?? []) {
        if (field.type === 'relation' && field.relationType === 'many-to-one') {
          const userKeyProp = `${field.name}UserKey`;
          if (!(userKeyProp in payload)) {
            continue;
          }

          const userKeyValue = payload[userKeyProp];
          if (userKeyValue === null || userKeyValue === undefined || userKeyValue === '') {
            delete payload[userKeyProp];
            continue;
          }

          const coModelName = field.relationCoModelSingularName;
          const coModelDef = coModelName ? modelsByName.get(coModelName) : null;
          if (!coModelDef) {
            throw new Error(`Test data relation model ${coModelName} not found in metadata, when attempting to resolve field ${modelDef.singularName}.${field.name}`);
          }
          const coUserKeyField = coModelDef.userKeyFieldUserKey;
          if (!coUserKeyField) {
            throw new Error(`Test data relation model ${coModelName} is missing userKeyFieldUserKey, when attempting to resolve field ${modelDef.singularName}.${field.name}`);
          }

          const coRepo = this.resolveRepository(coModelName);
          const related = typeof coRepo.findOneByUserKey === 'function'
            ? await coRepo.findOneByUserKey(userKeyValue)
            : await coRepo.findOne({ where: { [coUserKeyField]: userKeyValue } });
          if (!related) {
            throw new Error(`Test data relation not found: ${coModelName}.${coUserKeyField}=${userKeyValue}`);
          }

          payload[field.name] = related;
          delete payload[userKeyProp];
        }
      }

      // Strip media fields from entity payload — file paths cannot be saved as columns
      const mediaPayload: Record<string, string> = {};
      for (const field of modelDef.fields ?? []) {
        if ((field.type === 'mediaSingle' || field.type === 'mediaMultiple') && payload[field.name] !== undefined) {
          mediaPayload[field.name] = payload[field.name] as string;
          delete payload[field.name];
        }
      }

      // Strip many-to-many and one-to-many fields — these are resolved post-save via the relation builder
      const multiRelationPayload: Array<{ field: any; userKeys: string[] }> = [];
      for (const field of modelDef.fields ?? []) {
        if (field.type !== 'relation') continue;
        if (field.relationType !== 'many-to-many' && field.relationType !== 'one-to-many') continue;

        const userKeysProp = `${field.name}UserKeys`;
        if (userKeysProp in payload && Array.isArray(payload[userKeysProp])) {
          multiRelationPayload.push({ field, userKeys: payload[userKeysProp] });
          delete payload[userKeysProp];
        }
        // Remove raw field value if accidentally present
        delete payload[field.name];
      }

      // Upsert entity, capturing the saved result for post-save steps
      let savedEntity: any;
      const userKeyField = modelDef.userKeyFieldUserKey;
      if (userKeyField && payload[userKeyField] !== undefined) {
        const existing = await entityRepo.findOne({
          where: { [userKeyField]: payload[userKeyField] },
        });
        if (existing) {
          savedEntity = await entityRepo.save(entityRepo.merge(existing, payload));
        } else {
          savedEntity = await entityRepo.save(entityRepo.create(payload));
        }
      } else {
        savedEntity = await entityRepo.save(entityRepo.create(payload));
      }

      if (multiRelationPayload.length > 0) {
        await this.seedMultiRelations(savedEntity.id, modelUserKey, multiRelationPayload, modelsByName);
      }

      if (Object.keys(mediaPayload).length > 0) {
        await this.seedEntityMedia(savedEntity.id, modelUserKey, mediaPayload);
      }
    }
  }

  private async seedTestRoles(roles: TestingRoleSpec[]): Promise<void> {
    const roleService = this.moduleRef.get(RoleMetadataService, { strict: false });
    if (!roleService) {
      throw new Error('RoleMetadataService not available — cannot seed test roles.');
    }

    await roleService.createRolesIfNotExists(roles.map((r) => ({ name: r.name } as any)));

    for (const role of roles) {
      const perms = role.permissions ?? [];
      if (perms.length === 0) continue;

      if (perms.some((p) => p === '*')) {
        await roleService.addAllPermissionsToRole(role.name);
        this.logger.log(`Bound all permissions to test role "${role.name}"`);
        continue;
      }

      const expanded = await this.expandPermissionNames(perms);
      if (expanded.length === 0) {
        this.logger.warn(`Test role "${role.name}" has permissions declared but none resolved — skipping binding.`);
        continue;
      }

      try {
        await roleService.addPermissionsToRole(role.name, expanded);
      } catch (err: any) {
        throw new Error(
          `Failed to bind permissions to test role "${role.name}": ${err?.message ?? err}. ` +
          `Did you run "solid seed" first so controller permissions are registered?`,
        );
      }
      this.logger.log(`Bound ${expanded.length} permissions to test role "${role.name}"`);
    }
  }

  private async expandPermissionNames(permissions: string[]): Promise<string[]> {
    const permissionRepo = this.moduleRef.get(PermissionMetadataRepository, { strict: false });
    if (!permissionRepo) {
      throw new Error('PermissionMetadataRepository not available — cannot resolve test role permissions.');
    }

    const exact = new Set<string>();
    const prefixes: string[] = [];
    for (const entry of permissions) {
      if (!entry) continue;
      if (entry.endsWith('.*')) {
        prefixes.push(entry.slice(0, -1));
      } else {
        exact.add(entry);
      }
    }

    if (prefixes.length > 0) {
      const allPermissions = await permissionRepo.find();
      for (const p of allPermissions) {
        if (prefixes.some((prefix) => p.name.startsWith(prefix))) {
          exact.add(p.name);
        }
      }
    }

    return Array.from(exact);
  }

  private async seedTestUsers(users: TestingUserSpec[]): Promise<void> {
    const userService = this.moduleRef.get(UserService, { strict: false });
    const authService = this.moduleRef.get(AuthenticationService, { strict: false });
    if (!userService || !authService) {
      throw new Error('UserService / AuthenticationService not available — cannot seed test users.');
    }

    for (const user of users) {
      const existing = await userService.findOneByUsername(user.username);
      if (existing) {
        this.logger.debug(`Test user "${user.username}" already exists — skipping signUp.`);
        continue;
      }

      await authService.signUp({ ...user });
      this.logger.log(`Created test user "${user.username}"${user.roles?.length ? ` with roles [${user.roles.join(', ')}]` : ''}`);
    }
  }

  private async seedMultiRelations(
    entityId: number,
    modelUserKey: string,
    relations: Array<{ field: any; userKeys: string[] }>,
    modelsByName: Map<string, CreateModelMetadataDto>,
  ): Promise<void> {
    for (const { field, userKeys } of relations) {
      if (!userKeys.length) continue;

      const coModelName = field.relationCoModelSingularName;
      const coModelDef = modelsByName.get(coModelName);
      if (!coModelDef) {
        throw new Error(`Relation model "${coModelName}" not found in metadata for field ${modelUserKey}.${field.name}`);
      }
      const coUserKeyField = coModelDef.userKeyFieldUserKey;
      if (!coUserKeyField) {
        throw new Error(`Relation model "${coModelName}" is missing userKeyFieldUserKey, needed to resolve ${modelUserKey}.${field.name}`);
      }

      const coRepo = this.resolveRepository(coModelName);
      const resolvedIds: number[] = [];
      for (const uk of userKeys) {
        const related = typeof coRepo.findOneByUserKey === 'function'
          ? await coRepo.findOneByUserKey(uk)
          : await coRepo.findOne({ where: { [coUserKeyField]: uk } });
        if (!related) {
          throw new Error(`Related entity not found: ${coModelName}.${coUserKeyField}=${uk}`);
        }
        resolvedIds.push(related.id);
      }

      // Load currently associated entities to diff (set semantics — idempotent)
      const existingRelated: any[] = await this.entityManager
        .createQueryBuilder()
        .relation(classify(modelUserKey), field.name)
        .of(entityId)
        .loadMany();
      const existingIds: number[] = existingRelated.map((e) => e.id);

      const toAdd = resolvedIds.filter((id) => !existingIds.includes(id));
      const toRemove = existingIds.filter((id) => !resolvedIds.includes(id));

      if (toAdd.length > 0 || toRemove.length > 0) {
        await this.entityManager
          .createQueryBuilder()
          .relation(classify(modelUserKey), field.name)
          .of(entityId)
          .addAndRemove(toAdd, toRemove);
      }

      this.logger.debug(`Seeded ${field.relationType} relation ${modelUserKey}.${field.name} entityId=${entityId}: +${toAdd.length} -${toRemove.length}`);
    }
  }

  private async seedEntityMedia(
    entityId: number,
    modelUserKey: string,
    mediaPayload: Record<string, string>,
  ): Promise<void> {
    const mediaBasePath = process.env.TEST_UPLOADS_MEDIA_FILE_PATH;
    if (!mediaBasePath) {
      throw new Error('TEST_UPLOADS_MEDIA_FILE_PATH is not set. Cannot seed test media.');
    }

    const modelMetadata = await this.modelMetadataService.findOneBySingularName(modelUserKey, {
      fields: {
        model: { userKeyField: true },
        mediaStorageProvider: true,
      },
    });

    for (const [fieldName, fileName] of Object.entries(mediaPayload)) {
      if (!fileName) continue;

      const fieldMetadata = modelMetadata.fields.find((f) => f.name === fieldName);
      if (!fieldMetadata) {
        throw new Error(`Media field "${fieldName}" not found in loaded metadata for model ${modelUserKey}`);
      }
      if (!fieldMetadata.mediaStorageProvider) {
        throw new Error(`Media field "${fieldName}" in model ${modelUserKey} has no storage provider configured`);
      }

      const storageProviderType = fieldMetadata.mediaStorageProvider.type as MediaStorageProviderType;
      if (storageProviderType !== MediaStorageProviderType.Filesystem) {
        throw new Error(`Test media seeding supports filesystem storage only. Field "${fieldName}" uses "${storageProviderType}".`);
      }

      // Idempotency: skip if media already exists for this entity + field
      const existing = await this.mediaRepository.findByEntityIdAndFieldIdAndModelMetadataId(
        entityId, fieldMetadata.id, fieldMetadata.model.id,
      );
      if (existing.length > 0) {
        this.logger.debug(`Media already seeded for ${modelUserKey}.${fieldName} entityId=${entityId}, skipping`);
        continue;
      }

      const sourcePath = path.join(mediaBasePath, fileName);
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Test media file not found: ${sourcePath}`);
      }

      const storageProvider = await getMediaStorageProvider(this.moduleRef, storageProviderType);
      const stream = fs.createReadStream(sourcePath);
      await storageProvider.storeStreams([[stream, fileName]], { id: entityId }, fieldMetadata);
      this.logger.debug(`Seeded media for ${modelUserKey}.${fieldName} entityId=${entityId} file=${fileName}`);
    }
  }

  private get entityManager(): EntityManager {
    return this.moduleRef.get(EntityManager, { strict: false });
  }

  private get modelMetadataService(): ModelMetadataService {
    return this.moduleRef.get(ModelMetadataService, { strict: false });
  }

  private get mediaRepository(): MediaRepository {
    return this.moduleRef.get(MediaRepository, { strict: false });
  }

  private resolveRepository(modelUserKey: string): any {
    const repoName = `${classify(modelUserKey)}Repository`;
    const providers = this.discoveryService.getProviders();
    const wrapper = providers.find((provider) => provider.name === repoName);
    const repo = wrapper?.instance;
    if (repo) {
      return repo;
    }

    try {
      const resolved = this.moduleRef.get(repoName as any, { strict: false });
      if (resolved) {
        return resolved;
      }
    } catch {
      // fall through
    }

    throw new Error(`Repository not found for model ${modelUserKey}. Expected provider: ${repoName}`);
  }

  private generateDbRunName(): string {
    const adjectives = [
      'brave', 'bright', 'calm', 'clever', 'curious', 'gentle', 'jolly', 'lively', 'mighty', 'nimble',
      'proud', 'quick', 'quiet', 'sharp', 'sly', 'steady', 'swift', 'wise', 'witty', 'zesty',
    ];
    const animals = [
      'lion', 'tiger', 'panther', 'eagle', 'falcon', 'otter', 'wolf', 'fox', 'bear', 'badger',
      'monkey', 'panda', 'leopard', 'whale', 'dolphin', 'rhino', 'giraffe', 'camel', 'koala', 'lynx',
    ];
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const animal = animals[Math.floor(Math.random() * animals.length)];
    return `${adjective}_${animal}`;
  }

  private getTimestamp(): string {
    const now = new Date();
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }

  private buildTestEnvContents(baseEnv: string, dbNameByDatasource: Map<string, string>): string {
    const datasourceNameSet = new Set(Array.from(dbNameByDatasource.keys()));
    const lines = baseEnv.split(/\r?\n/);
    return lines
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
          return line;
        }
        const [rawKey] = line.split('=');
        const key = rawKey.trim();
        if (!key.endsWith('_DATABASE_NAME')) {
          return line;
        }
        const prefix = key.replace(/_DATABASE_NAME$/, '').toLowerCase();
        const matchedDatasource = Array.from(datasourceNameSet).find((name) => name === prefix);
        if (!matchedDatasource) {
          return line;
        }
        const dbName = dbNameByDatasource.get(matchedDatasource);
        if (!dbName) {
          return line;
        }
        return `${key}=${dbName}`;
      })
      .join('\n');
  }

  private async createTestDatabaseObjects(dbNameByDatasource: Map<string, string>): Promise<void> {
    for (const [dsName, dbName] of dbNameByDatasource.entries()) {
      const dataSource = this.resolveDataSourceByName(dsName);
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }

      console.log(`Creating test database/schema "${dbName}" on datasource "${dsName}"...`);

      const queryRunner = dataSource.createQueryRunner();
      try {
        const type = dataSource.options.type;
        if (type === 'postgres') {
          await queryRunner.query(`CREATE DATABASE "${dbName}"`);
        } else if (type === 'mssql') {
          await queryRunner.query(
            `IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = '${dbName}') EXEC('CREATE SCHEMA [${dbName}]')`,
          );
        } else if (type === 'mysql' || type === 'mariadb') {
          await queryRunner.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        } else {
          throw new Error(`Unsupported database type for test data creation: ${type}`);
        }
      } finally {
        await queryRunner.release();
      }
    }
  }

  private resolveDataSourceByName(datasourceName: string): DataSource {
    const token = datasourceName ? getDataSourceToken(datasourceName) : getDataSourceToken();
    try {
      const ds = this.moduleRef.get<DataSource>(token, { strict: false });
      if (!ds) {
        throw new Error(`No DataSource found for "${datasourceName}"`);
      }
      return ds;
    } catch (err: any) {
      throw new Error(`Failed to resolve DataSource "${datasourceName}": ${err?.message ?? err}`);
    }
  }

  private updateTestManifest(
    dbRunName: string,
    timestamp: string,
    dbNameByDatasource: Map<string, string>,
  ): void {
    const manifestPath = path.join(process.cwd(), '.solidx-test-manifest');
    let manifest: Record<string, any> = {};
    if (fs.existsSync(manifestPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        if (parsed && typeof parsed === 'object') {
          manifest = parsed;
        }
      } catch {
        // fall through with empty manifest
      }
    }

    if (!manifest.runs || typeof manifest.runs !== 'object') {
      manifest.runs = {};
    }

    const databases: Record<string, string> = {};
    for (const [dsName, dbName] of dbNameByDatasource.entries()) {
      databases[dsName] = dbName;
    }

    manifest.runs[dbRunName] = {
      createdAt: timestamp,
      databases,
    };

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }

  private async dropTestDatabaseObjects(databases: Record<string, string>): Promise<void> {
    const entries = Object.entries(databases);
    for (const [dsName, dbName] of entries) {
      await this.dropTestDatabaseObjectsWithRetry(dsName, dbName);
    }
  }

  private async dropTestDatabaseObjectsWithRetry(dsName: string, dbName: string): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= ModuleTestDataService.TEARDOWN_RETRY_ATTEMPTS; attempt += 1) {
      console.log(`Attempting to tear down "${dbName}" on datasource "${dsName}" (${attempt}/${ModuleTestDataService.TEARDOWN_RETRY_ATTEMPTS})...`);

      try {
        await this.dropSingleTestDatabaseObject(dsName, dbName);
        return;
      } catch (error) {
        lastError = error;
        if (attempt >= ModuleTestDataService.TEARDOWN_RETRY_ATTEMPTS) {
          throw error;
        }

        await this.sleep(this.teardownRetryDelayMs(attempt));
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private teardownRetryDelayMs(attempt: number): number {
    const baseMs = 500;
    const incrementMs = 350;
    const jitterMs = Math.floor(Math.random() * 250);
    return baseMs + ((attempt - 1) * incrementMs) + jitterMs;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async dropSingleTestDatabaseObject(dsName: string, dbName: string): Promise<void> {
    const dataSource = this.resolveDataSourceByName(dsName);

    if (dataSource.options.type === 'postgres') {
      await this.dropPostgresDatabase(dataSource, dbName);
      return;
    }

    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }

    const queryRunner = dataSource.createQueryRunner();
    try {
      const type = dataSource.options.type;
      if (type === 'mssql') {
        await this.dropMssqlSchema(queryRunner, dbName);
      } else if (type === 'mysql' || type === 'mariadb') {
        await queryRunner.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
      } else {
        throw new Error(`Unsupported database type for test data deletion: ${type}`);
      }
    } finally {
      await queryRunner.release();
    }
  }

  private async dropPostgresDatabase(dataSource: DataSource, dbName: string): Promise<void> {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }

    const adminDataSource = new DataSource({
      ...(dataSource.options as any),
      database: this.resolvePostgresMaintenanceDatabase(dataSource),
      name: `${String(dataSource.name ?? 'default')}_teardown_admin_${Date.now()}`,
      synchronize: false,
      migrationsRun: false,
      entities: [],
      subscribers: [],
      migrations: [],
    });

    try {
      await adminDataSource.initialize();
      const queryRunner = adminDataSource.createQueryRunner();
      try {
        await queryRunner.query(
          `SELECT pg_terminate_backend(pid)
             FROM pg_stat_activity
            WHERE datname = $1
              AND pid <> pg_backend_pid()`,
          [dbName],
        );
        await queryRunner.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      } finally {
        await queryRunner.release();
      }
    } finally {
      if (adminDataSource.isInitialized) {
        await adminDataSource.destroy();
      }
    }
  }

  private resolvePostgresMaintenanceDatabase(dataSource: DataSource): string {
    const configured = process.env.POSTGRES_MAINTENANCE_DATABASE?.trim();
    if (configured) {
      return configured;
    }

    const currentDb = String((dataSource.options as any)?.database ?? '').trim();
    if (currentDb && currentDb !== 'postgres') {
      return 'postgres';
    }

    return 'template1';
  }

  private async dropMssqlSchema(queryRunner: ReturnType<DataSource['createQueryRunner']>, schemaName: string): Promise<void> {
    const foreignKeys: Array<{ fk_name: string; table_name: string }> = await queryRunner.query(
      `SELECT fk.name AS fk_name, t.name AS table_name
       FROM sys.foreign_keys fk
       INNER JOIN sys.tables t ON fk.parent_object_id = t.object_id
       INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
       WHERE s.name = '${schemaName}'`,
    );
    for (const fk of foreignKeys) {
      await queryRunner.query(`ALTER TABLE [${schemaName}].[${fk.table_name}] DROP CONSTRAINT [${fk.fk_name}]`);
    }

    const tables: Array<{ TABLE_NAME: string }> = await queryRunner.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = '${schemaName}'`,
    );
    for (const table of tables) {
      await queryRunner.query(`DROP TABLE [${schemaName}].[${table.TABLE_NAME}]`);
    }

    const views: Array<{ TABLE_NAME: string }> = await queryRunner.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_SCHEMA = '${schemaName}'`,
    );
    for (const view of views) {
      await queryRunner.query(`DROP VIEW [${schemaName}].[${view.TABLE_NAME}]`);
    }

    await queryRunner.query(`DROP SCHEMA [${schemaName}]`);
  }
}
