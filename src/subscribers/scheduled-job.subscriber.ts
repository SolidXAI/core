import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import * as fs from "fs/promises";
import {
  DataSource,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
} from "typeorm";
import { ScheduledJob } from "src/entities/scheduled-job.entity";
import { ModuleMetadataHelperService } from "src/helpers/module-metadata-helper.service";
import { CreateScheduledJobDto, ScheduledJobRepository } from "src/repository/scheduled-job.repository";
import { ModuleMetadata } from "src/entities/module-metadata.entity";
import { where } from "locale-codes";

@Injectable()
export class ScheduledJobSubscriber
  implements EntitySubscriberInterface<ScheduledJob>
{
  private readonly logger = new Logger(ScheduledJobSubscriber.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly moduleMetadataHelperService: ModuleMetadataHelperService,
    private readonly scheduledJobRepo: ScheduledJobRepository
  ) {
    this.dataSource.subscribers.push(this);
  }

  listenTo() {
    return ScheduledJob;
  }

  async afterInsert(event: InsertEvent<ScheduledJob>) {
    await this.updateMetadata(event);
  }

  async afterUpdate(event: UpdateEvent<ScheduledJob>) {
    await this.updateMetadata(event);
  }

  async afterRemove(event: RemoveEvent<ScheduledJob>) {
    await this.removeMetadata(event);
  }

  private async removeMetadata(event: RemoveEvent<ScheduledJob>) {
    const jobEntity = event.entity;
    const moduleMetadata = jobEntity?.module;

    if (!moduleMetadata) {
      this.logger.error(
        `Module metadata not found for scheduled job with ID ${jobEntity?.id}`
      );
      return;
    }

    const moduleMetadataRepo = this.dataSource.getRepository(ModuleMetadata);
    const populatedModuleMetadata = await moduleMetadataRepo.findOne({
      where: { id: moduleMetadata.id },
    });

    if (!populatedModuleMetadata) {
      this.logger.error(
        `Could not find ModuleMetadata with ID ${moduleMetadata.id}`
      );
      return;
    }
    const filePath =
      await this.moduleMetadataHelperService.getModuleMetadataFilePath(
        populatedModuleMetadata.name
      );
    try {
      await fs.access(filePath);
    } catch {
      this.logger.error(`Metadata file not found: ${filePath}`);
      return;
    }
    const metaData =
      await this.moduleMetadataHelperService.getModuleMetadataConfiguration(
        filePath
      );
    // Remove, update or insert logic
    const jobName = jobEntity.scheduleName;
    const existingIndex = metaData.scheduledJobs.findIndex(
      (job) => job.scheduleName === jobName
    );
    if (existingIndex !== -1) {
      metaData.scheduledJobs.splice(existingIndex, 1);
      this.logger.log(`Removed scheduled job ${jobName} from metadata`);
    }
    const updatedContent = JSON.stringify(metaData, null, 2);
    await fs.writeFile(filePath, updatedContent);
    this.logger.log(`Updated scheduledJobs in ${filePath}`);
  }

  private async updateMetadata(
    event: UpdateEvent<ScheduledJob> | InsertEvent<ScheduledJob>
  ) {
    const jobEntity = event.entity;
    const moduleMetadata = jobEntity?.module;

    if (!moduleMetadata) {
      this.logger.error(
        `Module metadata not found for scheduled job with ID ${jobEntity?.id}`
      );
      return;
    }

    const moduleMetadataRepo = this.dataSource.getRepository(ModuleMetadata);
    const populatedModuleMetadata = await moduleMetadataRepo.findOne({
      where: { id: moduleMetadata.id },
    });

    if (!populatedModuleMetadata) {
      this.logger.error(
        `Could not find ModuleMetadata with ID ${moduleMetadata.id}`
      );
      return;
    }
    const filePath =
      await this.moduleMetadataHelperService.getModuleMetadataFilePath(
        populatedModuleMetadata.name
      );

    try {
      await fs.access(filePath);
    } catch {
      this.logger.error(`Metadata file not found: ${filePath}`);
      return;
    }

    const metaData =
      await this.moduleMetadataHelperService.getModuleMetadataConfiguration(
        filePath
      );

    // Ensure scheduledJobs exists
    if (!metaData.scheduledJobs) {
      metaData.scheduledJobs = [];
    }

    // Remove, update or insert logic
    const jobName = jobEntity.scheduleName;
    const existingIndex = metaData.scheduledJobs.findIndex(
      (job) => job.scheduleName === jobName
    );
    // Insert or update job in metadata
    const jobDto= await this.scheduledJobRepo.toDto(jobEntity as ScheduledJob);
    if (existingIndex !== -1) {
      metaData.scheduledJobs[existingIndex] = jobDto;
      this.logger.log(`Updated scheduled job ${jobName} in metadata`);
    } else {
      metaData.scheduledJobs.push(jobDto);
      this.logger.log(`Added scheduled job ${jobName} to metadata`);
    }

    const updatedContent = JSON.stringify(metaData, null, 2);
    await fs.writeFile(filePath, updatedContent);
    this.logger.log(`Updated scheduledJobs in ${filePath}`);
  }
}
