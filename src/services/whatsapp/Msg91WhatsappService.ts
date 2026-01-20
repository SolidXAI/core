import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { QueueMessage } from 'src/interfaces/mq';
import { IWhatsAppTransport } from "../../interfaces";
import { PublisherFactory } from '../queues/publisher-factory.service';
import { WhatsAppProvider } from 'src/decorators/whatsapp-provider.decorator';
import { SettingService } from '../setting.service';

enum Msg91WhatsappParameterHeaderType {
  image,
  text,
}

export interface Msg91WhatsappParameter {
  header?: {
    type: Msg91WhatsappParameterHeaderType;
    value: string;
  };
  body: string[];
}

interface WhatsappRequest {
  integrated_number: string;
  content_type: string;
  payload: WhatsappPayload;
}

interface WhatsappPayload {
  messaging_product: string;
  type: string;
  template: WhatsappTemplate;
}

interface WhatsappTemplate {
  name: string;
  language: WhatsappLanguage;
  namespace: string;
  to_and_components: WhatsappToAndComponents[];
}

interface WhatsappLanguage {
  code: string;
  policy: string;
}

interface WhatsappToAndComponents {
  to: string[];
  components: any;
}

@Injectable()
@WhatsAppProvider()
export class Msg91WhatsappService implements IWhatsAppTransport {
  readonly logger = new Logger(Msg91WhatsappService.name);

  constructor(
    // whatsappPublisher: WhatsappQueuePublisher,
    private readonly publisherFactory: PublisherFactory<any>,
    private readonly httpService: HttpService,
    private readonly settingService: SettingService
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
    return this.publisherFactory.publish(message, 'Msg91WhatsappQueuePublisher');
  }

  async sendWhatsAppMessageSynchronously(message: QueueMessage<any>): Promise<void> {
    const body = await this.createWhatsappRequest(message);
    const headers = { authkey: await this.settingService.getConfigValue("whatsapp", "msg91WhatsappApiKey") };
    await this.httpService.axiosRef.post(
      `${await this.settingService.getConfigValue("whatsapp", "msg91WhatsappUrl")}`,
      body,
      { headers },
    );
    this.logger.debug(
      `Sending Whatsapp message for CP registration with body ${JSON.stringify(body)} and url ${await this.settingService.getConfigValue("whatsapp", "msg91WhatsappUrl")}`,
    );
  }

  private async createWhatsappRequest(message: QueueMessage<any>): Promise<WhatsappRequest> {
    const { to, templateId, ...parameters } = message.payload;
    const whatsappToAndComponents = this.createWhatsappToAndComponents(
      to,
      parameters,
    );
    const whatsappLanguage = {
      code: 'en',
      policy: 'deterministic',
    };
    const whatsappTemplate = this.createWhatsappTemplate(
      templateId,
      whatsappToAndComponents,
      whatsappLanguage,
    );
    const whatsappPayload = {
      messaging_product: 'whatsapp',
      type: 'template',
      template: whatsappTemplate,
    };
    return {
      integrated_number: await this.settingService.getConfigValue("whatsapp", "msg91WhatsappIntegratedNumber"),
      content_type: 'template',
      payload: whatsappPayload,
    };
  }

  private createWhatsappToAndComponents(
    to: string,
    parameters: Msg91WhatsappParameter,
  ): WhatsappToAndComponents {
    return {
      to: [to],
      components: this.createWhatsappComponents(parameters),
    };
  }

  private createWhatsappComponents(parameters: Msg91WhatsappParameter): any {
    const components = {};
    if (parameters.header) {
      components['header_1'] = {
        type: parameters.header.type,
        value: parameters.header.value,
      };
    }
    if (parameters.body && parameters.body.length > 0) {
      parameters.body.forEach((elem, index) => {
        components[`body_${index + 1}`] = {
          type: 'text',
          value: elem,
        };
      });
    }
    return components;
  }

  private createWhatsappTemplate(
    templateName: string,
    toAndComponents: WhatsappToAndComponents,
    language: WhatsappLanguage,
  ): WhatsappTemplate {
    return {
      name: templateName,
      language: language,
      namespace: null,
      to_and_components: [toAndComponents],
    };
  }
}
