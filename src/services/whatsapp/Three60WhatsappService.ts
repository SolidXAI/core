import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import commonConfig from 'src/config/common.config';
import { QueueMessage } from 'src/interfaces/mq';
import { IWhatsAppTransport } from "../../interfaces";
import { PublisherFactory } from '../queues/publisher-factory.service';
import { WhatsAppProvider } from 'src/decorators/whatsapp-provider.decorator';

@Injectable()
@WhatsAppProvider()
export class Three60WhatsappService implements IWhatsAppTransport {
  readonly logger = new Logger(Three60WhatsappService.name);

  constructor(
    @Inject(commonConfig.KEY)
    private readonly commonConfiguration: ConfigType<typeof commonConfig>,
    private readonly publisherFactory: PublisherFactory<any>,
    private readonly httpService: HttpService,
  ) { }

  async sendWhatsAppMessage(
    to: string,
    templateId: string,
    parameters: any,
    parentEntity?: any,
    parentEntityId?: any
  ): Promise<any> {
    const message = {
      payload: {
        to,
        templateId,
        ...parameters,
      },
      parentEntity,
      parentEntityId,
    };

    // All messages are always queued as per requirement
    return this.sendWhatsAppMessageAsynchronously(message);
  }

  private async sendWhatsAppMessageAsynchronously(message: any): Promise<any> {
    const { to, templateId } = message.payload;
    this.logger.debug(`Queueing WhatsApp message to ${to} with template ${templateId}`);
    return this.publisherFactory.publish(message, 'Three60WhatsappQueuePublisher');
  }

  async sendWhatsAppMessageSynchronously(message: QueueMessage<any>): Promise<void> {
    throw new Error(`Currently not implemented.`);
  }
}
