import { Injectable, Logger } from '@nestjs/common';
import { LessThan } from 'typeorm';
import { ScheduledJobProvider } from 'src/decorators/scheduled-job-provider.decorator';
import { ScheduledJob } from 'src/entities/scheduled-job.entity';
import { IScheduledJob } from 'src/services/scheduled-jobs/scheduled-job.interface';
import { ChatterMessage } from 'src/entities/chatter-message.entity';
import { ChatterMessageDetails } from 'src/entities/chatter-message-details.entity';
import { ChatterMessageRepository } from 'src/repository/chatter-message.repository';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { SettingService } from './setting.service';
import type { SolidCoreSetting } from './settings/default-settings-provider.service';

const BATCH_SIZE = 100;

@Injectable()
@ScheduledJobProvider()
export class ChatterMessageArchiveService implements IScheduledJob {
  private readonly logger = new Logger(ChatterMessageArchiveService.name);

  constructor(
    private readonly solidRegistry: SolidRegistry,
    private readonly settingService: SettingService,
    private readonly messageRepository: ChatterMessageRepository,
  ) {}

  async execute(_job: ScheduledJob): Promise<void> {
    const archive = this.solidRegistry.getChatterMessageArchiveProvider();
    if (!archive) return;

    const configuredDays = Number(this.settingService.getConfigValue<SolidCoreSetting>('CHATTER_MESSAGES_TO_ARCHIVE_AFTER_DAYS'));
    const days = Number.isFinite(configuredDays) && configuredDays >= 0 ? configuredDays : 180;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    let archivedCount = 0;

    while (true) {
      const batch = await this.messageRepository.find({
        where: { createdAt: LessThan(cutoff) },
        relations: { chatterMessageDetails: true, user: true },
        order: { id: 'ASC' },
        take: BATCH_SIZE,
      } as any);
      if (batch.length === 0) break;

      for (const message of batch) {
        try {
          await archive.archiveChatterMessage(message);
          // Archive first. If deletion fails, the idempotent archive write makes a retry safe.
          await this.messageRepository.manager.transaction(async manager => {
            await manager.delete(ChatterMessageDetails, { chatterMessage: { id: message.id } } as any);
            await manager.delete(ChatterMessage, message.id);
          });
          archivedCount++;
        } catch (error) {
          this.logger.error(`Could not archive chatter message ${message.id}; source record retained`, error as any);
          // Stop this run rather than repeatedly selecting a failed first row or skipping it.
          return;
        }
      }
    }
    if (archivedCount) this.logger.log(`Archived ${archivedCount} chatter message(s)`);
  }

  getArchivedMessage(id: number) {
    const archive = this.solidRegistry.getChatterMessageArchiveProvider();
    return archive ? archive.getChatterMessage(id) : null;
  }

  getArchivedMessages(filter: any) {
    const archive = this.solidRegistry.getChatterMessageArchiveProvider();
    return archive ? archive.getChatterMessages(filter) : null;
  }
}
