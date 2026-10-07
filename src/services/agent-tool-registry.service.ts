import { ConflictException, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef } from '@nestjs/core';
import { EntityManager } from 'typeorm';
import { createHash } from 'node:crypto';
import { AgentTool } from '../entities/agent-tool.entity';
import { AgentConfigCatalogService } from './agent-config-version.service';
import { AgentToolRegistry } from '../entities/agent-tool-registry.entity';
import { AgentToolRegistryRepository } from '../repository/agent-tool-registry.repository';
import { CreateAgentToolRegistryDto } from '../dtos/create-agent-tool-registry.dto';
import { UpdateAgentToolRegistryDto } from '../dtos/update-agent-tool-registry.dto';

@Injectable()
export class AgentToolRegistryService extends AgentConfigCatalogService<AgentToolRegistry>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: AgentToolRegistryRepository,
    readonly moduleRef: ModuleRef,
  ) {
   super(entityManager, repo, 'agentToolRegistry', moduleRef, AgentTool, 'agentToolRegistry');
 }

  private withChecksum<T extends { type?: string; sourceCode?: string; checksum?: string }>(dto: T, existing?: AgentToolRegistry): T {
    if (!['custom', 'thirdparty'].includes(dto.type ?? existing?.type)) return dto;

    const sourceCode = dto.sourceCode ?? existing?.sourceCode;
    if (typeof sourceCode !== 'string') return dto;

    return {
      ...dto,
      checksum: createHash('sha256').update(sourceCode, 'utf8').digest('hex'),
    };
  }

  override async create(createDto: CreateAgentToolRegistryDto, files: Express.Multer.File[] = [], solidRequestContext: any = {}): Promise<AgentToolRegistry> {
    return super.create(this.withChecksum({ ...createDto, status: 'inactive', lastLoadError: null }), files, solidRequestContext);
  }

  override async createMany(createDtos: CreateAgentToolRegistryDto[], solidRequestContext: any = {}): Promise<AgentToolRegistry[]> {
    return super.createMany(createDtos.map((dto) => this.withChecksum({ ...dto, status: 'inactive', lastLoadError: null })), solidRequestContext);
  }

  override async insertMany(createDtos: CreateAgentToolRegistryDto[], filesArray: Express.Multer.File[][] = [], solidRequestContext: any = {}): Promise<AgentToolRegistry[]> {
    return super.insertMany(createDtos.map((dto) => this.withChecksum({ ...dto, status: 'inactive', lastLoadError: null })), filesArray, solidRequestContext);
  }

  override async update(
    id: number,
    updateDto: UpdateAgentToolRegistryDto,
    files: Express.Multer.File[] = [],
    isPartialUpdate = false,
    solidRequestContext: any = {},
    isUpdate = false,
  ): Promise<AgentToolRegistry> {
    const existing = await this.repo.findOne({ where: { id } });
    const changed = existing && ['sourceCode', 'name', 'type'].some(
      (key) => updateDto[key] !== undefined && updateDto[key] !== existing[key],
    );
    if (!changed && updateDto.status === 'active' && existing?.status !== 'active'
        && existing && ['custom', 'thirdparty'].includes(existing.type)) {
      const checkedChecksum = createHash('sha256').update(existing.sourceCode ?? '', 'utf8').digest('hex');
      if (updateDto.checksum !== checkedChecksum) {
        throw new ConflictException('Tool source changed after checks. Run configuration and initialization again.');
      }
    }
    const dto = changed ? { ...updateDto, status: 'inactive', lastLoadError: null } : updateDto;
    return super.update(id, this.withChecksum(dto, existing ?? undefined), files, isPartialUpdate, solidRequestContext, isUpdate);
  }


}
