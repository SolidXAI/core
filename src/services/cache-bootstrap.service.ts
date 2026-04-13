import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { EntityManager } from 'typeorm';
import { SolidCacheService } from './solid-cache.service';

@Injectable()
export class CacheBootstrapService implements OnApplicationBootstrap {
    private readonly logger = new Logger(CacheBootstrapService.name);

    constructor(
        @InjectEntityManager()
        private readonly entityManager: EntityManager,
        private readonly solidCacheService: SolidCacheService,
    ) {}

    /**
     * On every app boot, bust Redis keys for all models configured with the
     * 'onReboot' cache strategy. This ensures stale data from the previous
     * instance does not survive a restart.
     *
     * In-memory store is cleared automatically on restart — no action needed there.
     */
    async onApplicationBootstrap(): Promise<void> {
        try {
            const models = await this.entityManager.find(ModelMetadata, {
                where: { cacheEnabled: true, cacheStrategy: 'onReboot' },
                select: ['singularName'],
            });

            if (models.length === 0) return;

            this.logger.log(`Busting onReboot cache for ${models.length} model(s)...`);

            await Promise.all(
                models.map(m => this.solidCacheService.bustModel(m.singularName)),
            );

            this.logger.log('onReboot cache bust complete.');
        } catch (err) {
            // Never block startup due to cache failures
            this.logger.warn(`Cache bootstrap bust failed: ${err.message}`);
        }
    }
}
