import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import commonConfig from 'src/config/common.config';
import { QueueMessage } from 'src/interfaces/mq';
import { SmsTemplateService } from '../sms-template.service';
import { Msg91BaseSMSService } from '../sms/Msg91BaseSMSService';
import { ISMS } from "../../interfaces";
import { PublisherFactory } from '../queues/publisher-factory.service';

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
export class Msg91WhatsappService extends Msg91BaseSMSService implements ISMS {
  readonly logger = new Logger(Msg91WhatsappService.name);

  constructor(
    @Inject(commonConfig.KEY)
    commonConfiguration: ConfigType<typeof commonConfig>,
    // whatsappPublisher: WhatsappQueuePublisher,
    publisherFactory: PublisherFactory<any>,
    smsTemplateService: SmsTemplateService,
    private readonly httpService: HttpService,
  ) {
    super(commonConfiguration, 'WhatsappQueuePublisher', publisherFactory, smsTemplateService);
  }

  async sendSMSSynchronously(message: QueueMessage<any>): Promise<void> {
    const body = this.createWhatsappRequest(message);
    const headers = { authkey: this.commonConfiguration.msg91Whatsapp.apiKey };
    await this.httpService.axiosRef.post(
      `${this.commonConfiguration.msg91Whatsapp.url}`,
      body,
      { headers },
    );
    this.logger.debug(
      `Sending Whatsapp message for CP registration with body ${JSON.stringify(body)} and url ${this.commonConfiguration.msg91Whatsapp.url}`,
    );
  }

  private createWhatsappRequest(message: QueueMessage<any>): WhatsappRequest {
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
      integrated_number:
        this.commonConfiguration.msg91Whatsapp.integratedNumber,
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
