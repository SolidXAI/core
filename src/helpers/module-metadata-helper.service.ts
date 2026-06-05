import { kebabCase } from 'lodash';
import { Injectable, Logger } from "@nestjs/common";
import * as fs from 'fs/promises'; // Use the Promise-based version of fs for async/await
import * as path from 'path'; // To handle file paths
import { SOLID_CORE_MODULE_NAME } from "src/constants";
import { DiskFileService } from "src/services/file";

@Injectable()
export class ModuleMetadataHelperService {
    private readonly logger = new Logger(ModuleMetadataHelperService.name);
    constructor(private readonly fileService: DiskFileService) { }
    // async getModuleMetadataConfig(moduleName: string): Promise<ModuleMetadata> {
    //     const filePath = this.getModuleMetadataFilePath(moduleName);
    //     const metadata = await this.getModuleMetadata(filePath);
    //     return metadata;
    // }

    async getModuleMetadataConfiguration(configFilePath: string): Promise<any> {
        if (!configFilePath) {
            return null;
        }
        try {
            const fileContent = await fs.readFile(configFilePath, 'utf8');
            return JSON.parse(fileContent);
        }
        catch (error: any) {
            this.logger.error(`module metadata configuration non existent at: ${configFilePath}`);
        }

        return null;
    }

    async getModulePath(moduleName: string): Promise<string> {
        if (!moduleName) {
            return '';
        }
        return path.resolve(process.cwd(), 'src', moduleName);
    }

    private resolveModuleMetadataFolderPath(moduleName: string): string {
        const dashModuleName = kebabCase(moduleName);
        return path.resolve(process.cwd(), 'src', dashModuleName, 'metadata');
    }

    async getModuleMetadataFilePath(moduleName: string): Promise<string> {
        if (!moduleName) {
            return '';
        }
        const dashModuleName = kebabCase(moduleName);
        const filePath = path.join(
            this.resolveModuleMetadataFolderPath(dashModuleName),
            `${dashModuleName}-metadata.json`,
        );

        if (dashModuleName === SOLID_CORE_MODULE_NAME) {
            const fallbackPath = path.resolve(process.cwd(), 'src', 'seeders', 'seed-data', `${dashModuleName}-metadata.json`);
            const fallbackExists = await this.fileService.exists(fallbackPath);
            if (fallbackExists) {
                this.logger.debug(`Fallback path: ${fallbackPath}`);
                return fallbackPath;
            }

            const consumingProjectFallbackPath = path.resolve(process.cwd(), 'node_modules', '@solidxai', 'core', 'src', 'seeders', 'seed-data', `${dashModuleName}-metadata.json`);
            const consumingProjectFallbackExists = await this.fileService.exists(consumingProjectFallbackPath);
            if (consumingProjectFallbackExists) {
                this.logger.debug(`Fallback path: ${consumingProjectFallbackPath}`);
                return consumingProjectFallbackPath;
            }
        }

        return filePath;
    }

    async getModuleMetadataFolderPath(moduleName: string): Promise<string> {
        if (!moduleName) {
            return '';
        }
        return this.resolveModuleMetadataFolderPath(moduleName);
    }

}
