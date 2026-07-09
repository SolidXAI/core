import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { CRUDService } from 'src/services/crud.service';
import { EntityManager } from 'typeorm';


import { ActionMetadataRepository } from 'src/repository/action-metadata.repository';
import { ActionMetadata } from '../entities/action-metadata.entity';

@Injectable()
export class ActionMetadataService extends CRUDService<ActionMetadata> {
  private readonly logger = new Logger(ActionMetadataService.name);
  private readonly comparableFields = [
    'name',
    'displayName',
    'type',
    'domain',
    'context',
    'customComponent',
    'customIsModal',
    'serverEndpoint',
    'module',
    'model',
    'view',
  ] as const;
  private readonly relationCompareFields = new Set(['module', 'model', 'view']);
  private readonly jsonCompareFields = new Set(['domain', 'context']);

  private normalizeJsonFieldValue(value: any): any {
    if (typeof value === 'string') {
      const trimmedValue = value.trim();
      if (
        (trimmedValue.startsWith('{') && trimmedValue.endsWith('}')) ||
        (trimmedValue.startsWith('[') && trimmedValue.endsWith(']'))
      ) {
        try {
          return this.normalizeJsonFieldValue(JSON.parse(trimmedValue));
        } catch {
          return value;
        }
      }
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeJsonFieldValue(item));
    }

    if (value && typeof value === 'object') {
      return Object.keys(value)
        .sort()
        .reduce((result, key) => {
          result[key] = this.normalizeJsonFieldValue(value[key]);
          return result;
        }, {} as Record<string, any>);
    }

    return value;
  }

  private getCanonicalJsonFieldString(value: any): string {
    return JSON.stringify(this.normalizeJsonFieldValue(value) ?? null);
  }

  private hasChanges(existingSolidAction: ActionMetadata, updateSolidActionDto: any): boolean {
    return this.comparableFields.some((key) => {
      const value = updateSolidActionDto[key];
      if (typeof value === 'undefined') {
        return false;
      }

      if (this.relationCompareFields.has(key)) {
        const relationValue = value as any;
        return (existingSolidAction as any)[key]?.id !== relationValue?.id;
      }

      if (this.jsonCompareFields.has(key)) {
        return this.getCanonicalJsonFieldString((existingSolidAction as any)[key]) !== this.getCanonicalJsonFieldString(value);
      }

      return (existingSolidAction as any)[key] !== value;
    });
  }

  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(ActionMetadata, 'default')
    // readonly repo: Repository<ActionMetadata>,
    readonly repo: ActionMetadataRepository,
    readonly moduleRef: ModuleRef

  ) {
    super(entityManager, repo, 'actionMetadata', 'solid-core', moduleRef);
  }

  async findOneByUserKey(name: string, relations = {}) {
    const entity = await this.repo.findOne({
      where: {
        name: name,
      },
      relations: relations,
    });
    return entity;
  }

  async upsert(updateSolidActionDto: any) {
    // First check if module already exists using name
    const existingSolidAction = await this.repo.findOne({
      where: {
        name: updateSolidActionDto.name
      },
      relations: {
        module: true,
        model: true,
        view: true,
      },
    })

    // if found
    if (existingSolidAction) {
      const hasChanges = this.hasChanges(existingSolidAction, updateSolidActionDto);

      if (!hasChanges) {
        this.logger.debug(`Skipping action upsert for ${updateSolidActionDto.name}; no changes detected.`);
        return existingSolidAction;
      }

      const updatedSolidActionDto = { ...existingSolidAction, ...updateSolidActionDto };
      return this.repo.save(updatedSolidActionDto);
    }
    // if not found - create new 
    else {
      const moduleMetadata = this.repo.create(updateSolidActionDto);
      return this.repo.save(moduleMetadata);
    }
  }

}
