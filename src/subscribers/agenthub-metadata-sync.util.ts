import { Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import { SOLID_CORE_MODULE_NAME } from 'src/constants';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';

const metadataUpdateQueues = new Map<string, Promise<void>>();

export async function updateModuleMetadataJson(
    moduleName: string | undefined,
    helper: ModuleMetadataHelperService,
    logger: Logger,
    update: (metadata: any) => boolean,
): Promise<void> {
    if (!moduleName || moduleName === SOLID_CORE_MODULE_NAME) return;

    const filePath = await helper.getModuleMetadataFilePath(moduleName);
    const previous = metadataUpdateQueues.get(filePath) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(async () => {
        try {
            await fs.access(filePath);
        } catch {
            logger.error(`Module metadata file not found: ${filePath}`);
            return;
        }

        const metadata = await helper.getModuleMetadataConfiguration(filePath);
        if (!metadata) throw new Error(`Module metadata could not be read: ${filePath}`);
        if (update(metadata)) await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
    });
    metadataUpdateQueues.set(filePath, current);
    try {
        await current;
    } finally {
        if (metadataUpdateQueues.get(filePath) === current) metadataUpdateQueues.delete(filePath);
    }
}

export async function syncEntityTagsToModuleMetadataJson(
    moduleName: string | undefined,
    metadataKey: 'agenthubAgents' | 'agenthubSkills' | 'agenthubTools',
    entityName: string,
    tags: Array<{ name: string }>,
    helper: ModuleMetadataHelperService,
    logger: Logger,
): Promise<void> {
    await updateModuleMetadataJson(moduleName, helper, logger, (metadata) => {
        const entries = metadata[metadataKey];
        if (!Array.isArray(entries)) return false;
        const entity = entries.find((item: { name?: string }) => item.name === entityName);
        if (!entity) return false;

        const tagNames = tags.map((tag) => tag.name).sort();
        if (JSON.stringify(entity.tags ?? []) === JSON.stringify(tagNames)) return false;
        entity.tags = tagNames;
        return true;
    });
}
