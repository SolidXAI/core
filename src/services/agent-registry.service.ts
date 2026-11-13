import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager, In } from 'typeorm';
import { CRUDService } from './crud.service';
import { AgentRegistry } from '../entities/agent-registry.entity';
import { AgentRegistryRepository } from '../repository/agent-registry.repository';
import { AgentConfigVersion } from '../entities/agent-config-version.entity';
import { ActivateAgentRegistryDto } from '../dtos/activate-agent-registry.dto';
import { markActiveAgentsDraft } from './agent-config-version.service';
import { buildAgentConfigVersionName } from '../helpers/agent-config-version-name';
import { normalizeAgentRequiredInputs } from '../helpers/agent-required-inputs';
import { ModuleMetadataHelperService } from '../helpers/module-metadata-helper.service';
import { syncEntityTagsToModuleMetadataJson } from '../subscribers/agenthub-metadata-sync.util';

const RESERVED_AGENT_NAMES = new Set(['solidx-native', 'testhub']);

function assertNotReservedName(name: any): void {
  if (typeof name === 'string' && RESERVED_AGENT_NAMES.has(name.trim().toLowerCase())) {
    throw new BadRequestException(`"${name}" is a reserved built-in agent name.`);
  }
}

@Injectable()
export class AgentRegistryService extends CRUDService<AgentRegistry> implements OnModuleInit {
  private readonly logger = new Logger(AgentRegistryService.name);
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: AgentRegistryRepository,
    readonly moduleRef: ModuleRef,
      
 ) {
   super(entityManager, repo, 'agentRegistry', 'agent-hub', moduleRef);
 }

  async onModuleInit(): Promise<void> {
    if (typeof this.entityManager?.query !== 'function') return;
    try {
      const dbType = this.entityManager.connection?.options?.type;
      if (dbType === 'postgres') {
        await this.entityManager.query(
          `DO $$ BEGIN IF to_regclass('ss_agent_registry') IS NOT NULL THEN ALTER TABLE "ss_agent_registry" ADD COLUMN IF NOT EXISTS "is_builtin" boolean NOT NULL DEFAULT false; END IF; END $$;`,
        );
      } else if (dbType === 'mssql') {
        await this.entityManager.query(
          `IF OBJECT_ID('ss_agent_registry', 'U') IS NOT NULL AND COL_LENGTH('ss_agent_registry', 'is_builtin') IS NULL BEGIN ALTER TABLE [ss_agent_registry] ADD [is_builtin] bit NOT NULL DEFAULT 0 END`,
        );
      }
    } catch (err: any) {
      this.logger.warn(`Could not ensure is_builtin column on ss_agent_registry: ${err?.message ?? err}`);
    }
  }

  override async create(createDto: any, files: Express.Multer.File[] = [], solidRequestContext: any = {}): Promise<AgentRegistry> {
    assertNotReservedName(createDto?.name);
    return super.create({ ...createDto, isBuiltin: false, requiredInputs: normalizeAgentRequiredInputs(createDto.requiredInputs), configVersion: 1 }, files, solidRequestContext);
  }

  override async createMany(createDtos: any[], solidRequestContext: any = {}): Promise<AgentRegistry[]> {
    createDtos.forEach((dto) => assertNotReservedName(dto?.name));
    return super.createMany(createDtos.map((dto) => ({ ...dto, isBuiltin: false, requiredInputs: normalizeAgentRequiredInputs(dto.requiredInputs), configVersion: 1 })), solidRequestContext);
  }

  override async update(id: number, updateDto: any, files: Express.Multer.File[] = [], isPartialUpdate = false, solidRequestContext: any = {}, isUpdate = false): Promise<AgentRegistry> {
    const existing = await this.repo.findOne({ where: { id }, relations: { module: true }, withDeleted: true });
    if (!existing) {
      throw new NotFoundException(`Agent ${id} was not found.`);
    }

    const { configVersion: _ignored, ...changes } = updateDto;

    if (existing.isBuiltin) {
      if (changes.name !== undefined && changes.name !== existing.name) {
        throw new BadRequestException(`Cannot rename built-in agent "${existing.name}".`);
      }
      const rawModule = changes.module?.name ?? changes.moduleUserKey ?? changes.module ?? changes.moduleId;
      if (rawModule !== undefined) {
        const existingModuleId = existing.module?.id;
        const existingModuleName = existing.module?.name;
        const isMatch = (existingModuleId != null && (rawModule === existingModuleId || String(rawModule) === String(existingModuleId)))
          || (existingModuleName != null && rawModule === existingModuleName)
          || (existingModuleId == null && (rawModule === null || rawModule === ""));
        if (!isMatch) {
          throw new BadRequestException(`Cannot change the module of built-in agent "${existing.name}".`);
        }
      }
      if (changes.isBuiltin !== undefined && changes.isBuiltin !== true) {
        throw new BadRequestException(`Cannot unset built-in status of agent "${existing.name}".`);
      }
    } else {
      if (changes.name !== undefined && changes.name !== existing.name) {
        assertNotReservedName(changes.name);
      }
      if (changes.isBuiltin !== undefined && changes.isBuiltin === true) {
        throw new BadRequestException(`Cannot mark an ordinary agent as built-in.`);
      }
    }

    if ('requiredInputs' in changes) changes.requiredInputs = normalizeAgentRequiredInputs(changes.requiredInputs);
    const saved = await super.update(id, changes, files, isPartialUpdate, solidRequestContext, isUpdate);
    if ('tagsCommand' in changes) {
      const agent = await this.repo.findOne({ where: { id: saved.id }, relations: { module: true, tags: true } });
      if (agent) {
        await syncEntityTagsToModuleMetadataJson(
          agent.module?.name,
          'agenthubAgents',
          agent.name,
          agent.tags ?? [],
          this.moduleRef.get(ModuleMetadataHelperService, { strict: false }),
          this.logger,
        );
      }
    }
    await markActiveAgentsDraft(this.entityManager, [saved.id]);
    return this.repo.findOne({ where: { id: saved.id } });
  }

  override async delete(id: number, solidRequestContext: any = {}): Promise<any> {
    const existing = await this.repo.findOne({ where: { id }, withDeleted: true });
    if (existing && existing.isBuiltin) {
      throw new BadRequestException(`Built-in agent "${existing.name}" is protected and cannot be deleted.`);
    }
    return super.delete(id, solidRequestContext);
  }

  override async deleteMany(ids: number[], solidRequestContext: any = {}): Promise<any> {
    if (Array.isArray(ids) && ids.length > 0) {
      const builtin = await this.repo.findOne({ where: { id: In(ids), isBuiltin: true }, withDeleted: true });
      if (builtin) {
        throw new BadRequestException(`Built-in agent "${builtin.name}" is protected and cannot be deleted.`);
      }
    }
    return super.deleteMany(ids, solidRequestContext);
  }

  async activate(id: number, dto: ActivateAgentRegistryDto = {}): Promise<AgentRegistry> {
    return this.entityManager.transaction(async (manager) => {
      const agentRepository = manager.getRepository(AgentRegistry);
      const versionRepository = manager.getRepository(AgentConfigVersion);
      const agent = await agentRepository.findOne({ where: { id } });
      if (!agent) throw new NotFoundException(`Agent ${id} was not found.`);

      const latestVersion = await versionRepository.findOne({
        where: { agentRegistry: { id } },
        order: { versionNumber: 'DESC' },
      });
      const currentVersion = Math.max(Number(agent.configVersion ?? 1), Number(latestVersion?.versionNumber ?? 0));
      const versionNumber = latestVersion ? currentVersion + 1 : currentVersion;

      await versionRepository.save(versionRepository.create({
        agentRegistry: agent,
        versionNumber,
        name: buildAgentConfigVersionName(dto.name, versionNumber),
        description: dto.description?.trim() || null,
      }));

      agent.configVersion = versionNumber;
      agent.status = 'active';
      return agentRepository.save(agent);
    });
  }
}
