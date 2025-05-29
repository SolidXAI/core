import { Injectable, ModuleMetadata } from "@nestjs/common";
import * as fs from 'fs/promises'; // Use the Promise-based version of fs for async/await
import * as path from 'path'; // To handle file paths
import { ModuleMetadataConfiguration } from "src/interfaces";

@Injectable()
export class ModuleMetadataHelperService {
    // async getModuleMetadataConfig(moduleName: string): Promise<ModuleMetadata> {
    //     const filePath = this.getModuleMetadataFilePath(moduleName);
    //     const metadata = await this.getModuleMetadata(filePath);
    //     return metadata;
    // }

    async getModuleMetadataConfiguration(configFilePath: string): Promise<any> {
        const fileContent = await fs.readFile(configFilePath, 'utf8');
        return JSON.parse(fileContent);
    }

    getModuleMetadataFilePath(moduleName: string): string {
        const folderPath = path.resolve(process.cwd(), 'module-metadata', moduleName);
        const filePath = path.join(folderPath, `${moduleName}-metadata.json`);
        return filePath;
    }
}