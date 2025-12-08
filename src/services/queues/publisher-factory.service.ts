import { forwardRef, Inject, Logger } from '@nestjs/common';
import { Injectable } from '@nestjs/common';

import { QueueMessage, QueuePublisher } from 'src/interfaces/mq';
import { classify } from '@angular-devkit/core/src/utils/strings';
import { SolidIntrospectService } from '../solid-introspect.service';


@Injectable()
export class PublisherFactory<T> {
    private readonly logger = new Logger(PublisherFactory.name);

    constructor(
        @Inject(forwardRef(() => SolidIntrospectService))
        private readonly solidIntrospectionService: SolidIntrospectService
    ) {
    }

    async publish(message: QueueMessage<T>, publisherName: string, brokerToUse?: string): Promise<string> {
        let defaultBrokerToUse = brokerToUse || process.env.QUEUES_DEFAULT_BROKER || "database";
        let resolvedPublisherName = `${publisherName}${classify(defaultBrokerToUse)}`;

        // Register all ISolidDatabaseModules implementations
        let actualPublisherToUse = this.solidIntrospectionService.getProvider(resolvedPublisherName);
        if (!actualPublisherToUse) {

            // Extra check in place to make sure we do not have to refactor old publishers which have been created earlier. 
            if (defaultBrokerToUse === 'rabbitmq') {
                actualPublisherToUse = this.solidIntrospectionService.getProvider(publisherName);
                if (!actualPublisherToUse) {
                    throw new Error(`Unable to locate publisher with name ${resolvedPublisherName}`);
                }
            }
        }

        // type safe
        const typedActualPublisher: QueuePublisher<T> = actualPublisherToUse.instance;
        this.logger.debug(`Resolved publisher with name ${actualPublisherToUse.name}, and with options: ${JSON.stringify(typedActualPublisher.options())}`);

        return typedActualPublisher.publish(message);
    }
}
