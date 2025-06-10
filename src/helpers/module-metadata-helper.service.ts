import { Injectable, Logger } from "@nestjs/common";
import * as fs from 'fs/promises'; // Use the Promise-based version of fs for async/await
import * as path from 'path'; // To handle file paths
import { SOLID_CORE_MODULE_NAME } from "src/constants";
import { FileService } from "src/services/file.service";

@Injectable()
export class ModuleMetadataHelperService {
    private readonly logger = new Logger(ModuleMetadataHelperService.name);
    constructor(private readonly fileService: FileService) {}
    // async getModuleMetadataConfig(moduleName: string): Promise<ModuleMetadata> {
    //     const filePath = this.getModuleMetadataFilePath(moduleName);
    //     const metadata = await this.getModuleMetadata(filePath);
    //     return metadata;
    // }

    async getModuleMetadataConfiguration(configFilePath: string): Promise<any> {
        const fileContent = await fs.readFile(configFilePath, 'utf8');
        return JSON.parse(fileContent);
    }

    async getModulePath(moduleName: string): Promise<string> {
        return path.resolve(process.cwd(), 'src', moduleName);
    }

    async getModuleMetadataFilePath(moduleName: string): Promise<string> {
        const folderPath = path.resolve(process.cwd(), 'module-metadata', moduleName);
        const filePath = path.join(folderPath, `${moduleName}-metadata.json`);
        // Check if filePath exists
        const fileExists = await this.fileService.fileExists(filePath);
        this.logger.debug(`File exists: ${fileExists} at ${filePath}`);
        if (!fileExists) {
            // If the module is solid-core, try the fallback path, in case the current root directory is the solid core project
            if (moduleName === SOLID_CORE_MODULE_NAME) {
                const fallbackPath = path.resolve(process.cwd(), 'src', 'seeders', 'seed-data', `${moduleName}-metadata.json`);
                this.logger.debug(`Fallback path: ${fallbackPath}`);
                return fallbackPath;
            }
        }
        return filePath;
    }
}