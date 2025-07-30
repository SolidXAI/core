import { Injectable, Logger } from "@nestjs/common";
import { ModuleMetadata } from "src/entities/module-metadata.entity";
import { ScheduledJob } from "src/entities/scheduled-job.entity";
import { SolidRegistry } from "src/helpers/solid-registry";
import { CrudHelperService } from "src/services/crud-helper.service";
import { DataSource, Repository } from "typeorm";

// This should match whatever DTO structure you’re using in your seeding logic
export type CreateScheduledJobDto = {
  scheduleName: string;
  isActive?: boolean;
  frequency: string;
  startTime?: Date;
  endTime?: Date;
  startDate?: Date;
  endDate?: Date;
  dayOfMonth?: number;
  lastRunAt?: Date;
  nextRunAt?: Date;
  dayOfWeek?: string;
  job: string;
  moduleUserKey: string;
};

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
  async toDto(scheduledJob: CreateScheduledJobDto): Promise<Record<string, any>> {
    return {
      scheduleName: scheduledJob.scheduleName,
      isActive: scheduledJob.isActive,
      frequency: scheduledJob.frequency,
      startTime: scheduledJob.startTime,
      endTime: scheduledJob.endTime,
      startDate: scheduledJob.startDate,
      endDate: scheduledJob.endDate,
      dayOfMonth: scheduledJob.dayOfMonth,
      lastRunAt: scheduledJob.lastRunAt,
      nextRunAt: scheduledJob.nextRunAt,
      dayOfWeek: scheduledJob.dayOfWeek,
      job: scheduledJob.job,
      moduleUserKey: scheduledJob.moduleUserKey,
    };
  }

  async upsertWithDto(dto: CreateScheduledJobDto): Promise<ScheduledJob> {
    const moduleRepo = this.dataSource.getRepository(ModuleMetadata);

    const moduleEntity = await moduleRepo.findOne({
      where: { name: dto.moduleUserKey },
    });

    if (!moduleEntity) {
      throw new Error(`Module with ID ${dto.moduleUserKey} not found`);
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
