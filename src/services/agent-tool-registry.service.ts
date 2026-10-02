import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { createHash } from 'node:crypto';
import { AgentConfigCatalogService } from './agent-config-version.service';
import { AgentToolRegistry } from '../entities/agent-tool-registry.entity';
import { AgentTool } from '../entities/agent-tool.entity';
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
    if ((dto.type ?? existing?.type) !== 'custom') return dto;

    const sourceCode = dto.sourceCode ?? existing?.sourceCode;
    if (typeof sourceCode !== 'string') return dto;

    return {
      ...dto,
      checksum: createHash('sha256').update(sourceCode, 'utf8').digest('hex'),
    };
  }

  override async create(createDto: CreateAgentToolRegistryDto, files: Express.Multer.File[] = [], solidRequestContext: any = {}): Promise<AgentToolRegistry> {
    return super.create(this.withChecksum(createDto), files, solidRequestContext);
  }

  override async insertMany(createDtos: CreateAgentToolRegistryDto[], filesArray: Express.Multer.File[][] = [], solidRequestContext: any = {}): Promise<AgentToolRegistry[]> {
    return super.insertMany(createDtos.map((dto) => this.withChecksum(dto)), filesArray, solidRequestContext);
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
    return super.update(id, this.withChecksum(updateDto, existing ?? undefined), files, isPartialUpdate, solidRequestContext, isUpdate);
  }
}
