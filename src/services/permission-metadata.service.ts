import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { CRUDService } from 'src/services/crud.service';
import { shouldUseCache } from 'src/helpers/cache.helper';
import { EntityManager, In } from 'typeorm';


import { PermissionMetadataRepository } from 'src/repository/permission-metadata.repository';
import { PermissionMetadata } from '../entities/permission-metadata.entity';

@Injectable()
export class PermissionMetadataService extends CRUDService<PermissionMetadata> {
  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(PermissionMetadata, 'default')
    // readonly repo: Repository<PermissionMetadata>,
    readonly repo: PermissionMetadataRepository,
    readonly moduleRef: ModuleRef,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    super(entityManager, repo, 'permissionMetadata', 'solid-core',moduleRef);
  }

  private buildPermissionsByRoleCacheKey(roleName: string): string {
    return `permissions:role:${roleName}`;
  }

  async findAllUsingRoles(roles: string[]): Promise<PermissionMetadata[]> {
    const useCache = shouldUseCache();
    const cached: PermissionMetadata[] = [];
    const uncachedRoles: string[] = [];

    if (useCache) {
      for (const role of roles) {
        const hit = await this.cacheManager.get<PermissionMetadata[]>(this.buildPermissionsByRoleCacheKey(role));
        if (hit) {
          cached.push(...hit);
        } else {
          uncachedRoles.push(role);
        }
      }
    } else {
      uncachedRoles.push(...roles);
    }

    if (uncachedRoles.length === 0) {
      return cached;
    }

    const fromDb = await this.repo.find({
      where: { roles: { name: In(uncachedRoles) } },
      relations: { roles: true },
    });

    if (useCache) {
      for (const role of uncachedRoles) {
        const permsForRole = fromDb.filter(p => p.roles?.some(r => r.name === role));
        await this.cacheManager.set(this.buildPermissionsByRoleCacheKey(role), permsForRole);
      }
    }

    const seen = new Set<number>();
    return [...cached, ...fromDb].filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }

  async permissionExistsInRole(role: string, permission: string): Promise<PermissionMetadata[]> {
    const useCache = shouldUseCache();
    const cacheKey = this.buildPermissionsByRoleCacheKey(role);

    if (useCache) {
      const hit = await this.cacheManager.get<PermissionMetadata[]>(cacheKey);
      if (hit) {
        return hit.filter(p => p.name === permission);
      }
    }

    const fromDb = await this.repo.find({
      where: { roles: { name: role } },
      relations: { roles: true },
    });

    if (useCache) {
      await this.cacheManager.set(cacheKey, fromDb);
    }

    return fromDb.filter(p => p.name === permission);
  }

}


