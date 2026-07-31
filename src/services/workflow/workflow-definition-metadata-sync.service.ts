import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { WorkflowDefinition } from 'src/entities/workflow-definition.entity';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';

type WorkflowMetadataEntry = {
  key: string;
  moduleUserKey: string;
  displayName: string;
  namespace?: string;
  description?: string;
  status?: string;
  definitionVersion?: string;
  tags?: any;
  definitionYaml: string;
};

@Injectable()
export class WorkflowDefinitionMetadataSyncService {
  private readonly logger = new Logger(WorkflowDefinitionMetadataSyncService.name);

  constructor(
    private readonly moduleMetadataHelperService: ModuleMetadataHelperService,
  ) {}

  async upsertWorkflowDefinition(
    workflowDefinition: WorkflowDefinition,
    previousWorkflowDefinition?: WorkflowDefinition | null,
  ): Promise<void> {
    const moduleName = workflowDefinition.moduleMetadata?.name;
    if (!moduleName) {
      this.logger.warn(`Skipping workflow metadata sync for ${workflowDefinition.key}: moduleMetadata relation is not loaded.`);
      return;
    }

    if (
      previousWorkflowDefinition &&
      (
        previousWorkflowDefinition.key !== workflowDefinition.key ||
        previousWorkflowDefinition.moduleMetadata?.name !== moduleName
      )
    ) {
      await this.removeWorkflowDefinition(previousWorkflowDefinition);
    }

    const metadataFilePath = await this.getExistingMetadataFilePath(moduleName);
    if (!metadataFilePath) {
      return;
    }

    const metadata = await this.moduleMetadataHelperService.getModuleMetadataConfiguration(metadataFilePath);
    if (!metadata) {
      return;
    }

    const yamlRelativePath = this.getWorkflowYamlRelativePath(workflowDefinition.key);
    const yamlFilePath = path.resolve(path.dirname(metadataFilePath), yamlRelativePath);

    await fs.mkdir(path.dirname(yamlFilePath), { recursive: true });
    await fs.writeFile(yamlFilePath, this.withTrailingNewline(workflowDefinition.definitionYaml ?? ''), 'utf8');

    if (!Array.isArray(metadata.workflowDefinitions)) {
      metadata.workflowDefinitions = [];
    }

    const entry = this.toMetadataEntry(workflowDefinition, moduleName, yamlRelativePath);
    const existingIndex = metadata.workflowDefinitions.findIndex(
      (definition: WorkflowMetadataEntry) => definition.key === workflowDefinition.key,
    );

    if (existingIndex === -1) {
      metadata.workflowDefinitions.push(entry);
    } else {
      metadata.workflowDefinitions[existingIndex] = entry;
    }

    await this.writeMetadataFile(metadataFilePath, metadata);
    this.logger.log(`Synced workflow definition ${workflowDefinition.key} to ${metadataFilePath}`);
  }

  async removeWorkflowDefinition(workflowDefinition: WorkflowDefinition): Promise<void> {
    const moduleName = workflowDefinition.moduleMetadata?.name;
    if (!moduleName) {
      this.logger.warn(`Skipping workflow metadata removal for ${workflowDefinition.key}: moduleMetadata relation is not loaded.`);
      return;
    }

    const metadataFilePath = await this.getExistingMetadataFilePath(moduleName);
    if (!metadataFilePath) {
      return;
    }

    const metadata = await this.moduleMetadataHelperService.getModuleMetadataConfiguration(metadataFilePath);
    if (!metadata || !Array.isArray(metadata.workflowDefinitions)) {
      return;
    }

    const existingEntry = metadata.workflowDefinitions.find(
      (definition: WorkflowMetadataEntry) => definition.key === workflowDefinition.key,
    );
    const previousLength = metadata.workflowDefinitions.length;
    metadata.workflowDefinitions = metadata.workflowDefinitions.filter(
      (definition: WorkflowMetadataEntry) => definition.key !== workflowDefinition.key,
    );

    const yamlRelativePath = this.resolveWorkflowYamlReference(workflowDefinition, existingEntry);
    if (yamlRelativePath) {
      await this.removeYamlFile(path.resolve(path.dirname(metadataFilePath), yamlRelativePath));
    }

    if (metadata.workflowDefinitions.length !== previousLength) {
      await this.writeMetadataFile(metadataFilePath, metadata);
      this.logger.log(`Removed workflow definition ${workflowDefinition.key} from ${metadataFilePath}`);
    }
  }

  private async getExistingMetadataFilePath(moduleName: string): Promise<string | null> {
    const metadataFilePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(moduleName);
    try {
      await fs.access(metadataFilePath);
      return metadataFilePath;
    } catch {
      this.logger.warn(`Skipping workflow metadata sync because metadata file was not found: ${metadataFilePath}`);
      return null;
    }
  }

  private toMetadataEntry(
    workflowDefinition: WorkflowDefinition,
    moduleName: string,
    yamlRelativePath: string,
  ): WorkflowMetadataEntry {
    const entry: WorkflowMetadataEntry = {
      key: workflowDefinition.key,
      moduleUserKey: moduleName,
      displayName: workflowDefinition.displayName,
      definitionYaml: `file:${yamlRelativePath}`,
    };

    this.assignIfPresent(entry, 'namespace', workflowDefinition.namespace);
    this.assignIfPresent(entry, 'description', workflowDefinition.description);
    this.assignIfPresent(entry, 'status', workflowDefinition.status);
    this.assignIfPresent(entry, 'definitionVersion', workflowDefinition.definitionVersion);
    this.assignIfPresent(entry, 'tags', workflowDefinition.tags);

    return entry;
  }

  private assignIfPresent(target: WorkflowMetadataEntry, key: keyof WorkflowMetadataEntry, value: any) {
    if (value !== undefined && value !== null && value !== '') {
      (target as any)[key] = value;
    }
  }

  private getWorkflowYamlRelativePath(workflowKey: string) {
    return path.posix.join('workflows', `${this.safeWorkflowFileName(workflowKey)}.yaml`);
  }

  private safeWorkflowFileName(workflowKey: string) {
    return String(workflowKey ?? 'workflow')
      .trim()
      .replace(/[\\/]/g, '-')
      .replace(/^\.+/, '')
      || 'workflow';
  }

  private resolveWorkflowYamlReference(
    workflowDefinition: WorkflowDefinition,
    metadataEntry?: WorkflowMetadataEntry,
  ): string | null {
    if (typeof metadataEntry?.definitionYaml === 'string' && metadataEntry.definitionYaml.startsWith('file:')) {
      return metadataEntry.definitionYaml.slice('file:'.length).trim();
    }

    return this.getWorkflowYamlRelativePath(workflowDefinition.key);
  }

  private async removeYamlFile(filePath: string) {
    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        this.logger.warn(`Unable to remove workflow YAML file ${filePath}: ${error?.message ?? String(error)}`);
      }
    }
  }

  private async writeMetadataFile(metadataFilePath: string, metadata: any) {
    await fs.writeFile(metadataFilePath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  }

  private withTrailingNewline(value: string) {
    return value.endsWith('\n') ? value : `${value}\n`;
  }
}
