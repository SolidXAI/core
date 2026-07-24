import { Injectable, Logger } from '@nestjs/common';
import { ScheduledJobProvider } from 'src/decorators/scheduled-job-provider.decorator';
import { ScheduledJob } from 'src/entities/scheduled-job.entity';
import { IScheduledJob } from 'src/services/scheduled-jobs/scheduled-job.interface';
import { WorkflowDefinitionService } from '../workflow-definition.service';

@Injectable()
@ScheduledJobProvider()
export class WorkflowScheduledTriggerJobService implements IScheduledJob {
  private readonly logger = new Logger(WorkflowScheduledTriggerJobService.name);

  constructor(
    private readonly workflowDefinitionService: WorkflowDefinitionService,
  ) {}

  async execute(job: ScheduledJob): Promise<void> {
    const now = new Date();
    const windowStart =
      job.lastRunAt instanceof Date
        ? job.lastRunAt
        : new Date(now.getTime() - 5 * 60 * 1000);

    const result =
      await this.workflowDefinitionService.executeDueScheduledTriggers(
        windowStart,
        now,
      );

    this.logger.log(
      `Evaluated ${result.evaluated} scheduled workflow trigger(s), triggered ${result.triggered}, skipped ${result.skipped}.`,
    );
  }
}
