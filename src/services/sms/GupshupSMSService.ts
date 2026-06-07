import Handlebars from "handlebars";
import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { AxiosError } from "axios";
import { SmsProvider } from "src/decorators/sms-provider.decorator";
import { ISMS } from "src/interfaces";
import { SmsTemplateService } from "../sms-template.service";
import { SettingService } from "../setting.service";
import type { SolidCoreSetting } from "src/services/settings/default-settings-provider.service";
import { QueueMessage } from "src/interfaces/mq";
import { PublisherFactory } from "../queues/publisher-factory.service";

@Injectable()
@SmsProvider()
export class GupshupSMSService implements ISMS {
  private readonly logger = new Logger(GupshupSMSService.name);
  private readonly smsPublisher = "GupshupSmsQueuePublisher";

  constructor(
    private readonly publisherFactory: PublisherFactory<any>,
    private readonly httpService: HttpService,
    private readonly smsTemplateService: SmsTemplateService,
    private readonly settingService: SettingService,
  ) {}

  async sendSMS(
    to: string,
    body: string,
    shouldQueueSms: boolean,
  ): Promise<any> {
    const message = {
      payload: {
        to,
        body,
      },
    };

    if (
      shouldQueueSms === true ||
      this.settingService.getConfigValue<SolidCoreSetting>("shouldQueueSms") ===
        true
    ) {
      await this.sendSMSAsynchronously(message);
    } else {
      await this.sendSMSSynchronously(message);
    }

    return message;
  }

  async sendSMSAsynchronously(message: QueueMessage<any>) {
    const { to } = message.payload;

    await this.publisherFactory.publish(message, this.smsPublisher);

    this.logger.debug(`Queueing SMS to ${to}`);
  }

  async sendSMSUsingTemplate(
    to: string,
    templateName: string,
    templateParams: any,
    shouldQueueSms: boolean,
  ): Promise<any> {
    const smsTemplate =
      await this.smsTemplateService.findOneByName(templateName);
    if (!smsTemplate) {
      throw new Error(`Invalid template name ${templateName}`);
    }

    let body = "";
    try {
      const bodyTemplate = Handlebars.compile(smsTemplate.body || "");
      body = bodyTemplate(templateParams);
    } catch {
      throw new Error("Unable to compile sms template body");
    }

    const message = {
      payload: {
        to,
        body,
        templateId: smsTemplate.smsProviderTemplateId,
      },
    };

    if (
      shouldQueueSms === true ||
      this.settingService.getConfigValue<SolidCoreSetting>("shouldQueueSms") ===
        true
    ) {
      await this.sendSMSAsynchronously(message);
    } else {
      await this.sendSMSSynchronously(message);
    }

    return {
      to,
      body,
      templateId: smsTemplate.smsProviderTemplateId,
      templateName,
    };
  }

  public async sendSMSSynchronously(message: QueueMessage<any>): Promise<void> {
    const {
      to,
      destination,
      body,
      message: text,
      templateId,
    } = message.payload ?? {};
    const resolvedDestination = to ?? destination;
    const resolvedBody = body ?? text;
    const apiKey =
      this.settingService.getConfigValue<SolidCoreSetting>("gupshupSmsApiKey");
    const apiUrl =
      this.settingService.getConfigValue<SolidCoreSetting>(
        "gupshupSmsApiUrl",
      ) || "https://api.gupshup.io/sm/api/v1/msg";
    const source =
      this.settingService.getConfigValue<SolidCoreSetting>("gupshupSmsSource");
    const sourceName =
      this.settingService.getConfigValue<SolidCoreSetting>(
        "gupshupSmsSourceName",
      ) || "solidx";
    const entityId =
      this.settingService.getConfigValue<SolidCoreSetting>(
        "gupshupSmsEntityId",
      );

    if (!apiKey || !apiUrl || !source) {
      throw new Error("Missing Gupshup SMS configuration");
    }

    if (!resolvedDestination?.trim()) {
      throw new Error("SMS destination is required");
    }

    if (!resolvedBody?.trim()) {
      throw new Error("SMS body is required");
    }

    const sanitizedDestination = resolvedDestination.replace(/\D/g, "");
    const params = new URLSearchParams();
    if (templateId) {
      params.append("template_id", templateId);
    }
    params.append("channel", "sms");
    params.append("source", source);
    params.append("destination", sanitizedDestination);
    params.append("message", resolvedBody);
    params.append("src.name", sourceName);

    if (entityId) {
      params.append("entity_id", entityId);
    }

    try {
      const response = await this.httpService.axiosRef.post(
        apiUrl,
        params.toString(),
        {
          headers: {
            apikey: apiKey,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      this.logger.debug(
        `Gupshup SMS sent: status=${response.status}, destination=${sanitizedDestination}`,
      );
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `Gupshup SMS failed: destination=${sanitizedDestination}, status=${axiosError.response?.status ?? "unknown"}, response=${typeof axiosError.response?.data === "object" ? JSON.stringify(axiosError.response?.data) : axiosError.response?.data}`,
      );
      throw error;
    }
  }
}
