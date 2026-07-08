import { Injectable } from "@nestjs/common";
import { CreateScheduledJobDto } from "src/dtos/create-scheduled-job.dto";
import { ModuleMetadata } from "src/entities/module-metadata.entity";
import { ScheduledJob } from "src/entities/scheduled-job.entity";
import { RequestContextService } from "src/services/request-context.service";
import { DataSource } from "typeorm";
import { SecurityRuleRepository } from "./security-rule.repository";
import { SolidBaseRepository } from "./solid-base.repository";

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
export class ScheduledJobRepository extends SolidBaseRepository<ScheduledJob> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(ScheduledJob, dataSource, requestContextService, securityRuleRepository);
    }

  private normalizeComparableValue(value: any): any {
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === "string") {
      const trimmedValue = value.trim();
      if (
        (trimmedValue.startsWith("{") && trimmedValue.endsWith("}")) ||
        (trimmedValue.startsWith("[") && trimmedValue.endsWith("]"))
      ) {
        try {
          return this.normalizeComparableValue(JSON.parse(trimmedValue));
        } catch {
          return value;
        }
      }
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeComparableValue(item));
    }

    if (value && typeof value === "object") {
      return Object.keys(value)
        .sort()
        .reduce((result, key) => {
          result[key] = this.normalizeComparableValue(value[key]);
          return result;
        }, {} as Record<string, any>);
    }

    return value;
  }

  private areValuesDifferent(currentValue: any, nextValue: any): boolean {
    const normalizedCurrentValue = this.normalizeComparableValue(currentValue);
    const normalizedNextValue = this.normalizeComparableValue(nextValue);

    if (
      (normalizedCurrentValue && typeof normalizedCurrentValue === "object") ||
      (normalizedNextValue && typeof normalizedNextValue === "object")
    ) {
      return JSON.stringify(normalizedCurrentValue ?? null) !== JSON.stringify(normalizedNextValue ?? null);
    }

    return normalizedCurrentValue !== normalizedNextValue;
  }

  private hasChanges(existing: ScheduledJob, dto: CreateScheduledJobDto, moduleEntity: ModuleMetadata): boolean {
    return existing.scheduleName !== dto.scheduleName
      || existing.isActive !== dto.isActive
      || this.areValuesDifferent(existing.frequency, dto.frequency)
      || this.areValuesDifferent(existing.startTime, dto.startTime)
      || this.areValuesDifferent(existing.endTime, dto.endTime)
      || this.areValuesDifferent(existing.startDate, dto.startDate)
      || this.areValuesDifferent(existing.endDate, dto.endDate)
      || this.areValuesDifferent(existing.dayOfMonth, dto.dayOfMonth)
      || this.areValuesDifferent(existing.dayOfWeek, dto.dayOfWeek)
      || this.areValuesDifferent(existing.job, dto.job)
      || this.areValuesDifferent(existing.cronExpression, dto.cronExpression)
      || existing.module?.id !== moduleEntity.id;
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
      cronExpression: populatedScheduledJob.cronExpression,
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
      relations: {
        module: true,
      },
    });

    if (existing) {
      if (!this.hasChanges(existing, dto, moduleEntity)) {
        this.logger.debug(`Skipping scheduled job upsert for ${dto.scheduleName}; no changes detected.`);
        return existing;
      }

      const merged = this.merge(existing, jobData);
      this.logger.debug(`Updating scheduled job: ${dto.scheduleName}`);
      return this.save(merged);
    } else {
      this.logger.debug(`Creating scheduled job: ${dto.scheduleName}`);
      return this.save(this.create(jobData));
    }
  }
}
