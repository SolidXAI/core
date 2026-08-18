import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef } from "@nestjs/core";
import { EntityManager, In } from 'typeorm';
import { CRUDService } from 'src/services/crud.service';
import { WorkflowSecret } from '../entities/workflow-secret.entity';
import { WorkflowSecretRepository } from '../repository/workflow-secret.repository';
import { EncryptionService } from './encryption.service';

const MASKED_SECRET_VALUE = "********";

@Injectable()
export class WorkflowSecretService extends CRUDService<WorkflowSecret> {
  private readonly logger = new Logger(WorkflowSecretService.name);
  private readonly encryptionService: EncryptionService | null;

  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: WorkflowSecretRepository,
    readonly moduleRef: ModuleRef,
  ) {
    super(entityManager, repo, 'workflowSecret', 'solid-core', moduleRef);
    const encKey = process.env.APP_ENCRYPTION_KEY;
    this.encryptionService = encKey ? new EncryptionService(encKey) : null;
    if (!encKey) {
      this.logger.warn('APP_ENCRYPTION_KEY is not set — workflow secrets cannot be encrypted or decrypted');
    }
  }

  async create(createDto: any, files: Express.Multer.File[] = [], solidRequestContext: any = {}): Promise<WorkflowSecret> {
    const preparedDto = this.prepareSecretForSave(createDto, true);
    const saved = await super.create(preparedDto, files, solidRequestContext);
    return this.maskSecret(saved);
  }

  async update(
    id: number,
    updateDto: any,
    files: Express.Multer.File[] = [],
    isPartialUpdate = false,
    solidRequestContext: any = {},
    isUpdate = false,
  ): Promise<WorkflowSecret> {
    const preparedDto = this.prepareSecretForSave(updateDto, false);
    const saved = await super.update(id, preparedDto, files, isPartialUpdate, solidRequestContext, isUpdate);
    return this.maskSecret(saved);
  }

  async createMany(createDtos: any[], solidRequestContext: any = {}): Promise<WorkflowSecret[]> {
    const preparedDtos = createDtos.map((dto) => this.prepareSecretForSave(dto, true));
    const saved = await super.createMany(preparedDtos, solidRequestContext);
    return saved.map((secret) => this.maskSecret(secret));
  }

  async find(basicFilterDto: any, solidRequestContext: any = {}): Promise<any> {
    const response = await super.find(basicFilterDto, solidRequestContext);
    return {
      ...response,
      records: (response.records ?? []).map((secret: WorkflowSecret) => this.maskSecret(secret)),
    };
  }

  async findOne(id: number, query: any = {}, solidRequestContext: any = {}) {
    const secret = await super.findOne(id, query, solidRequestContext);
    return this.maskSecret(secret);
  }

  async getWorkflowSecretsContext(): Promise<Record<string, any>> {
    const secrets = await this.repo.find({
      where: { status: "active" } as any,
    });

    const context: Record<string, any> = {};
    for (const secret of secrets) {
      try {
        this.assignSecretPath(context, secret.key, this.decryptAndCoerce(secret));
        secret.lastAccessedAt = new Date();
      } catch (error) {
        this.logger.warn(`Failed to resolve workflow secret "${secret.key}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (secrets.length > 0) {
      await this.repo.save(secrets);
    }

    return context;
  }

  /**
   * Resolves one secret to its decrypted, type-coerced value.
   *
   * `key` is the literal key column value — "smtp.password" is one row, not a path.
   * Callers must resolve at point of use and must not cache the result.
   */
  async resolve(key: string): Promise<any> {
    const resolved = await this.resolveMany([key]);
    return resolved[key];
  }

  /**
   * Resolves several secrets in a single query, returning a flat map keyed by the
   * literal keys requested.
   *
   * Fail-closed: throws for a key that is missing, inactive or undecryptable rather
   * than omitting it from the result. A credential that silently resolves to undefined
   * becomes an empty password on an outbound request.
   */
  async resolveMany(keys: string[]): Promise<Record<string, any>> {
    const uniqueKeys = Array.from(new Set((keys ?? []).filter(Boolean)));
    if (uniqueKeys.length === 0) {
      return {};
    }

    const secrets = await this.repo.find({
      where: { key: In(uniqueKeys), status: "active" } as any,
    });
    const secretsByKey = new Map(secrets.map((secret) => [secret.key, secret]));

    const missing = uniqueKeys.filter((key) => !secretsByKey.has(key));
    if (missing.length > 0) {
      throw new NotFoundException(`No active secret found for: ${missing.join(', ')}`);
    }

    return uniqueKeys.reduce((resolved, key) => {
      resolved[key] = this.decryptAndCoerce(secretsByKey.get(key));
      return resolved;
    }, {} as Record<string, any>);
  }

  private prepareSecretForSave(dto: any, requireValue: boolean): any {
    const preparedDto = { ...dto };
    const rawValue = preparedDto.value;
    const hasNewValue = rawValue !== undefined && rawValue !== null && rawValue !== MASKED_SECRET_VALUE;

    if (requireValue && !hasNewValue) {
      throw new BadRequestException('Workflow secret value is required.');
    }

    if (hasNewValue) {
      preparedDto.value = this.encrypt(String(rawValue));
      preparedDto.lastRotatedAt = new Date();
    } else {
      delete preparedDto.value;
    }

    return preparedDto;
  }

  private encrypt(value: string): string {
    if (!this.encryptionService) {
      throw new BadRequestException('APP_ENCRYPTION_KEY must be set before workflow secrets can be saved.');
    }

    return this.encryptionService.isEncrypted(value) ? value : this.encryptionService.encrypt(value);
  }

  private decryptAndCoerce(secret: WorkflowSecret): any {
    if (!this.encryptionService) {
      throw new BadRequestException('APP_ENCRYPTION_KEY must be set before workflow secrets can be used.');
    }

    const decryptedValue = this.encryptionService.decrypt(secret.value);
    switch (secret.valueType) {
      case 'json':
        return JSON.parse(decryptedValue);
      case 'number':
        return Number(decryptedValue);
      case 'boolean':
        return decryptedValue === 'true' || decryptedValue === '1';
      case 'string':
      default:
        return decryptedValue;
    }
  }

  private assignSecretPath(target: Record<string, any>, key: string, value: any): void {
    const parts = String(key)
      .split('.')
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length === 0) {
      return;
    }

    let cursor = target;
    parts.slice(0, -1).forEach((part) => {
      cursor[part] = cursor[part] && typeof cursor[part] === 'object' ? cursor[part] : {};
      cursor = cursor[part];
    });
    cursor[parts[parts.length - 1]] = value;
  }

  private maskSecret(secret: WorkflowSecret): WorkflowSecret {
    if (secret) {
      secret.value = MASKED_SECRET_VALUE;
    }
    return secret;
  }
}
