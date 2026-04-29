import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { createHash } from 'crypto';
import { ModelMetadata } from '../entities/model-metadata.entity';
import { shouldUseCache } from 'src/helpers/cache.helper';
import { DataSource } from 'typeorm';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class ModelMetadataRepository extends SolidBaseRepository<ModelMetadata> {
    constructor(
        readonly dataSource: DataSource,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
        // readonly requestContextService: RequestContextService,
        // readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(ModelMetadata, dataSource, null, null);
    }

    async find(options?: any): Promise<ModelMetadata[]> {
        if (!shouldUseCache()) {
            return super.find(options);
        }

        const cacheKey = this.buildCacheKey('find', options);
        const cached = await this.cacheManager.get<ModelMetadata[]>(cacheKey);
        if (cached !== undefined) {
            return cached;
        }

        const result = await super.find(options);
        await this.cacheManager.set(cacheKey, result);
        return result;
    }

    async findOne(options: any): Promise<ModelMetadata | null> {
        if (!shouldUseCache()) {
            return super.findOne(options);
        }

        const cacheKey = this.buildCacheKey('findOne', options);
        const cached = await this.cacheManager.get<ModelMetadata | null>(cacheKey);
        if (cached !== undefined) {
            return cached;
        }

        const result = await super.findOne(options);
        await this.cacheManager.set(cacheKey, result);
        return result;
    }

    private buildCacheKey(method: 'find' | 'findOne', options: unknown): string {
        const serialized = JSON.stringify(options ?? {});
        const hash = createHash('sha256').update(serialized).digest('hex');
        return `modelMetadataRepo:${method}:${hash}`;
    }
}
