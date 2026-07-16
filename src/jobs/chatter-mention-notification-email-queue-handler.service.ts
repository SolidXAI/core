import { Injectable, Logger } from '@nestjs/common';
import { MailFactory } from 'src/factories/mail.factory';
import { ChatterMentionNotificationPayload } from 'src/interfaces/chatter-mention-notification.interface';
import { QueueMessage } from 'src/interfaces/mq';
import { UserRepository } from 'src/repository/user.repository';
import { SettingService } from 'src/services/setting.service';
import type { SolidCoreSetting } from 'src/services/settings/default-settings-provider.service';
import { In } from 'typeorm';

@Injectable()
export class ChatterMentionNotificationEmailQueueHandler {
    private readonly logger = new Logger(ChatterMentionNotificationEmailQueueHandler.name);

    constructor(
        private readonly mailFactory: MailFactory,
        private readonly userRepository: UserRepository,
        private readonly settingService: SettingService,
    ) {}

    private buildAdminRecordFormUrl(frontendAdminBaseUrl: string, moduleName: string, modelName: string, recordId: number) {
        if (!frontendAdminBaseUrl || !moduleName || !modelName || !recordId) return '';
        const normalizedModelName = modelName
            .trim()
            .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
            .replace(/[_\s]+/g, '-')
            .toLowerCase();
        return `${frontendAdminBaseUrl.replace(/\/+$/, '')}/admin/core/${moduleName.trim()}/${normalizedModelName}/form/${recordId}`;
    }

    async handle(message: QueueMessage<ChatterMentionNotificationPayload>) {
        const mailService = this.mailFactory.getMailService();
        const payload = message.payload;

        if (!payload?.mentions?.length) {
            this.logger.debug('Skipping chatter mention notification because no mentions were provided.');
            return { sent: 0 };
        }

        const mentionUserIds = payload.mentions
            .map(mention => Number(mention.id))
            .filter(id => Number.isInteger(id) && id > 0);
        const userIdsToLoad = Array.from(new Set([
            ...mentionUserIds,
            ...(payload.actor?.id ? [Number(payload.actor.id)] : []),
        ]));

        if (userIdsToLoad.length === 0) {
            this.logger.debug('Skipping chatter mention notification because mention user ids were not provided.');
            return { sent: 0 };
        }

        const users = await this.userRepository.find({
            where: { id: In(userIdsToLoad) },
        });
        const usersById = new Map(users.map(user => [Number(user.id), user]));
        const actor = payload.actor?.id ? usersById.get(Number(payload.actor.id)) : null;
        const recipients = Array.from(new Set(mentionUserIds))
            .map(id => {
                const user = usersById.get(id);
                const mention = payload.mentions.find(item => Number(item.id) === id);
                return {
                    id,
                    username: user?.username || mention?.username || '',
                    displayName: user?.fullName || mention?.displayName || user?.username || mention?.username || '',
                    email: user?.email || '',
                };
            })
            .filter(recipient => Boolean(recipient.email));

        if (recipients.length === 0) {
            this.logger.debug('Skipping chatter mention notification because no mentioned users have email addresses.');
            return { sent: 0 };
        }

        const frontendAdminBaseUrl = this.settingService.getConfigValue<SolidCoreSetting>('frontendAdminBaseUrl');
        const commonTemplateParams = {
            mentionedByDisplayName: actor?.fullName || payload.actor?.username || payload.actor?.email || 'Someone',
            mentionedByEmail: actor?.email || payload.actor?.email,
            noteBody: payload.noteBody,
            entityDisplayName: payload.entity.displayName,
            entityUserKey: payload.entity.userKey,
            entityFormUrl: this.buildAdminRecordFormUrl(
                frontendAdminBaseUrl,
                payload.entity.moduleName,
                payload.entity.modelName,
                payload.entity.id,
            ),
            solidAppName: this.settingService.getConfigValue<SolidCoreSetting>('appTitle'),
            solidAppWebsiteUrl: this.settingService.getConfigValue<SolidCoreSetting>('solidAppWebsiteUrl'),
            companyLogoUrl: this.settingService.getConfigValue<SolidCoreSetting>('companylogo'),
        };

        let sent = 0;
        for (const recipient of recipients) {
            await mailService.sendEmailUsingTemplate(
                recipient.email,
                payload.templateName,
                {
                    ...commonTemplateParams,
                    mentionedUserDisplayName: recipient.displayName || recipient.username,
                    mentionedUserUsername: recipient.username,
                },
                false,
                null,
                null,
                payload.parentEntity,
                payload.parentEntityId,
            );
            sent += 1;
        }

        return { sent };
    }
}
