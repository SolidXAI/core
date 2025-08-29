import { Injectable, Logger } from "@nestjs/common";
import { CreateScheduledJobDto } from "src/dtos/create-scheduled-job.dto";
import { ModuleMetadata } from "src/entities/module-metadata.entity";
import { ScheduledJob } from "src/entities/scheduled-job.entity";
import { SolidRegistry } from "src/helpers/solid-registry";
import { CrudHelperService } from "src/services/crud-helper.service";
import { DataSource, Repository } from "typeorm";

// This should match whatever DTO structure you’re using in your seeding logic
// export type CreateScheduledJobDto = {
//   scheduleName: string;
//   isActive?: boolean;
//   frequency: string;
//   startTime?: Date;
//   endTime?: Date;
//   startDate?: Date;
//   endDate?: Date;
//   dayOfMonth?: number;
//   lastRunAt?: Date;
//   nextRunAt?: Date;
//   dayOfWeek?: string;
//   job: string;
//   moduleUserKey: string;
// };

@Injectable()
export class ScheduledJobRepository extends Repository<ScheduledJob> {
  private readonly logger = new Logger(ScheduledJobRepository.name);

  constructor(
    private dataSource: DataSource,
    private readonly solidRegistry: SolidRegistry,
    private readonly crudHelperService: CrudHelperService
  ) {
    super(ScheduledJob, dataSource.createEntityManager());
  }

  /**
   * Converts an entity to a plain DTO object.
   */
  async toDto(scheduledJob: ScheduledJob): Promise<CreateScheduledJobDto> {
    let populatedScheduledJob: ScheduledJob = scheduledJob;
    // If the scheduled job does not have the module relation loaded, load it
    if (!scheduledJob.module) {
        populatedScheduledJob = await this.findOne({
            where: {
                id: scheduledJob.id,
            },
            relations: {
                module: true,
            },
        });
    }

    if (!populatedScheduledJob.module) {
        throw new Error(`Module not found for scheduled job ID ${populatedScheduledJob.id}`);
    }

    return {
      scheduleName: populatedScheduledJob.scheduleName,
      isActive: populatedScheduledJob.isActive,
      frequency: populatedScheduledJob.frequency,
      startTime: populatedScheduledJob.startTime,
      endTime: populatedScheduledJob.endTime,
      startDate: populatedScheduledJob.startDate,
      endDate: populatedScheduledJob.endDate,
      dayOfMonth: populatedScheduledJob.dayOfMonth,
      lastRunAt: populatedScheduledJob.lastRunAt,
      nextRunAt: populatedScheduledJob.nextRunAt,
      dayOfWeek: populatedScheduledJob.dayOfWeek,
      job: populatedScheduledJob.job,
      moduleUserKey: populatedScheduledJob.module.name,
      moduleId: populatedScheduledJob.module.id,
    };
  }

  async upsertWithDto(dto: CreateScheduledJobDto): Promise<ScheduledJob> {
    const moduleRepo = this.dataSource.getRepository(ModuleMetadata);

    const moduleEntity = await moduleRepo.findOne({
      where: { name: dto.moduleUserKey },
    });

    if (!moduleEntity) {
      throw new Error(`Module with userKey ${dto.moduleUserKey} not found`);
    }

    const jobData = {
      ...dto,
      module: moduleEntity,
    };
    const existing = await this.findOne({
      where: { scheduleName: dto.scheduleName },
    });

    if (existing) {
      const merged = this.merge(existing, jobData);
      this.logger.debug(`Updating scheduled job: ${dto.scheduleName}`);
      return this.save(merged);
    } else {
      this.logger.debug(`Creating scheduled job: ${dto.scheduleName}`);
      return this.save(this.create(jobData));
    }
  }
}
