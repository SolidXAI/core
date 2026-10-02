import { ModuleRef } from '@nestjs/core';
import { EntityManager, EntityTarget, In } from 'typeorm';
import { CommonEntity } from '../entities/common.entity';
import { AgentRegistry } from '../entities/agent-registry.entity';
import { CRUDService } from './crud.service';
import { SolidBaseRepository } from '../repository/solid-base.repository';

export async function bumpAgentConfigVersions(entityManager: EntityManager, agentIds: number[]): Promise<void> {
  const ids = [...new Set(agentIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) return;

  const column = entityManager.connection.getMetadata(AgentRegistry).findColumnWithPropertyName('configVersion');
  const versionColumn = entityManager.connection.driver.escape(column.databaseName);
  await entityManager.createQueryBuilder()
    .update(AgentRegistry)
    .set({ configVersion: () => `COALESCE(${versionColumn}, 1) + 1` })
    .whereInIds(ids)
    .execute();
}

export async function agentIdsForLinks(entityManager: EntityManager, linkEntity: EntityTarget<any>, linkIds: number[]): Promise<number[]> {
  if (!linkIds.length) return [];
  const links = await entityManager.getRepository(linkEntity).find({
    where: { id: In(linkIds) },
    relations: { agentRegistry: true },
  });
  return links.map((link) => link.agentRegistry?.id).filter((id): id is number => Number.isInteger(id));
}

export async function agentIdsForCatalog(
  entityManager: EntityManager,
  linkEntity: EntityTarget<any>,
  catalogRelation: string,
  catalogIds: number[],
): Promise<number[]> {
  if (!catalogIds.length) return [];
  const links = await entityManager.getRepository(linkEntity).find({
    where: { [catalogRelation]: { id: In(catalogIds) } },
    relations: { agentRegistry: true },
  });
  return links.map((link) => link.agentRegistry?.id).filter((id): id is number => Number.isInteger(id));
}

export abstract class AgentConfigLinkService<T extends CommonEntity> extends CRUDService<T> {
  constructor(
    entityManager: EntityManager,
    repo: SolidBaseRepository<T>,
    modelName: string,
    moduleRef: ModuleRef,
    private readonly linkEntity: EntityTarget<T>,
  ) {
    super(entityManager, repo, modelName, 'agent-hub', moduleRef);
  }

  override async create(createDto: any, files: Express.Multer.File[] = [], solidRequestContext: any = {}): Promise<T> {
    const saved = await super.create(createDto, files, solidRequestContext);
    await bumpAgentConfigVersions(this.entityManager, await agentIdsForLinks(this.entityManager, this.linkEntity, [saved.id]));
    return saved;
  }

  override async createMany(createDtos: any[], solidRequestContext: any = {}): Promise<T[]> {
    const saved = await super.createMany(createDtos, solidRequestContext);
    await bumpAgentConfigVersions(this.entityManager, await agentIdsForLinks(this.entityManager, this.linkEntity, saved.map((row) => row.id)));
    return saved;
  }

  override async update(id: number, updateDto: any, files: Express.Multer.File[] = [], isPartialUpdate = false, solidRequestContext: any = {}, isUpdate = false): Promise<T> {
    const before = await agentIdsForLinks(this.entityManager, this.linkEntity, [id]);
    const saved = await super.update(id, updateDto, files, isPartialUpdate, solidRequestContext, isUpdate);
    const after = await agentIdsForLinks(this.entityManager, this.linkEntity, [saved.id]);
    await bumpAgentConfigVersions(this.entityManager, [...before, ...after]);
    return saved;
  }

  override async delete(id: number, solidRequestContext: any = {}) {
    const agentIds = await agentIdsForLinks(this.entityManager, this.linkEntity, [id]);
    const result = await super.delete(id, solidRequestContext);
    await bumpAgentConfigVersions(this.entityManager, agentIds);
    return result;
  }

  override async deleteMany(ids: number[], solidRequestContext: any = {}) {
    const agentIds = await agentIdsForLinks(this.entityManager, this.linkEntity, ids);
    const result = await super.deleteMany(ids, solidRequestContext);
    await bumpAgentConfigVersions(this.entityManager, agentIds);
    return result;
  }
}

export abstract class AgentConfigCatalogService<T extends CommonEntity> extends CRUDService<T> {
  constructor(
    entityManager: EntityManager,
    repo: SolidBaseRepository<T>,
    modelName: string,
    moduleRef: ModuleRef,
    private readonly linkEntity: EntityTarget<any>,
    private readonly catalogRelation: string,
  ) {
    super(entityManager, repo, modelName, 'agent-hub', moduleRef);
  }

  private agentIds(catalogIds: number[]) {
    return agentIdsForCatalog(this.entityManager, this.linkEntity, this.catalogRelation, catalogIds);
  }

  override async create(createDto: any, files: Express.Multer.File[] = [], solidRequestContext: any = {}): Promise<T> {
    const saved = await super.create(createDto, files, solidRequestContext);
    await bumpAgentConfigVersions(this.entityManager, await this.agentIds([saved.id]));
    return saved;
  }

  override async createMany(createDtos: any[], solidRequestContext: any = {}): Promise<T[]> {
    const saved = await super.createMany(createDtos, solidRequestContext);
    await bumpAgentConfigVersions(this.entityManager, await this.agentIds(saved.map((row) => row.id)));
    return saved;
  }

  override async update(id: number, updateDto: any, files: Express.Multer.File[] = [], isPartialUpdate = false, solidRequestContext: any = {}, isUpdate = false): Promise<T> {
    const before = await this.agentIds([id]);
    const saved = await super.update(id, updateDto, files, isPartialUpdate, solidRequestContext, isUpdate);
    const after = await this.agentIds([saved.id]);
    await bumpAgentConfigVersions(this.entityManager, [...before, ...after]);
    return saved;
  }

  override async delete(id: number, solidRequestContext: any = {}) {
    const agentIds = await this.agentIds([id]);
    const result = await super.delete(id, solidRequestContext);
    await bumpAgentConfigVersions(this.entityManager, agentIds);
    return result;
  }

  override async deleteMany(ids: number[], solidRequestContext: any = {}) {
    const agentIds = await this.agentIds(ids);
    const result = await super.deleteMany(ids, solidRequestContext);
    await bumpAgentConfigVersions(this.entityManager, agentIds);
    return result;
  }
}
