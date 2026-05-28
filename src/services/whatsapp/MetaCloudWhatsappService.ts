import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { AxiosError } from "axios";
import { WhatsAppProvider } from "src/decorators/whatsapp-provider.decorator";
import { IWhatsAppTransport } from "src/interfaces";
import { QueueMessage } from "src/interfaces/mq";
import { SettingService } from "src/services/setting.service";
import type { SolidCoreSetting } from "src/services/settings/default-settings-provider.service";

type MetaTemplatePayload = {
  type?: "template";
  templateName?: string;
  templateId?: string;
  languageCode?: string;
  body?: string[];
  headerText?: string;
  imageLink?: string;
};

type MetaTextPayload = {
  type?: "text";
  text?: string;
  previewUrl?: boolean;
};

@Injectable()
@WhatsAppProvider()
export class MetaCloudWhatsappService implements IWhatsAppTransport {
  readonly logger = new Logger(MetaCloudWhatsappService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly settingService: SettingService,
  ) {}

  async sendWhatsAppMessage(
    to: string,
    templateId: string,
    parameters: any,
    parentEntity?: any,
    parentEntityId?: any,
  ): Promise<any> {
    const message: QueueMessage<any> = {
      payload: {
        to,
        templateId,
        ...parameters,
      },
      parentEntity,
      parentEntityId,
    };

    await this.sendWhatsAppMessageSynchronously(message);
    return message;
  }

  async sendWhatsAppMessageSynchronously(message: QueueMessage<any>): Promise<void> {
    const phoneNumberId = this.settingService.getConfigValue<SolidCoreSetting>(
      "metaWhatsappPhoneNumberId",
    );
    const apiVersion = this.settingService.getConfigValue<SolidCoreSetting>(
      "metaWhatsappApiVersion",
    );
    const apiBaseUrl = this.settingService.getConfigValue<SolidCoreSetting>(
      "metaWhatsappApiUrl",
    );
    const accessToken = this.settingService.getConfigValue<SolidCoreSetting>(
      "metaWhatsappAccessToken",
    );

    if (!phoneNumberId || !apiVersion || !apiBaseUrl || !accessToken) {
      throw new Error(
        "Missing Meta WhatsApp configuration. Set metaWhatsappApiUrl, metaWhatsappApiVersion, metaWhatsappPhoneNumberId, metaWhatsappAccessToken.",
      );
    }

    const requestBody = this.createWhatsappRequest(message);
    const url = `${String(apiBaseUrl).replace(/\/$/, "")}/${apiVersion}/${phoneNumberId}/messages`;

    try {
      await this.httpService.axiosRef.post(url, requestBody, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
      this.logger.debug(
        `Sent Meta WhatsApp message to ${message.payload?.to} with type ${requestBody.type}`,
      );
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const data = axiosError.response?.data;
      this.logger.error(
        `Meta WhatsApp send failed: status=${status ?? "unknown"}, url=${url}, response=${typeof data === "object" ? JSON.stringify(data) : data}`,
      );
      throw error;
    }
  }

  private createWhatsappRequest(message: QueueMessage<any>): any {
    const payload = message?.payload ?? {};

    if (payload?.payload) {
      const normalizedFromWrappedPayload = this.normalizeWrappedPayload(payload.payload);
      if (normalizedFromWrappedPayload) {
        return normalizedFromWrappedPayload;
      }
      return payload.payload;
    }

    const to = this.normalizePhone(payload.to);
    const templatePayload: MetaTemplatePayload = payload;
    const textPayload: MetaTextPayload = payload;

    if (textPayload.type === "text" || textPayload.text) {
      return {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: {
          body: textPayload.text ?? "",
          preview_url: Boolean(textPayload.previewUrl),
        },
      };
    }

    const templateName = payload.templateId || templatePayload.templateId || templatePayload.templateName;
    if (!templateName) {
      throw new Error(
        "Meta WhatsApp template name is missing. Provide templateId or parameters.templateName.",
      );
    }

    const components: any[] = [];
    if (templatePayload.headerText) {
      components.push({
        type: "header",
        parameters: [
          {
            type: "text",
            text: templatePayload.headerText,
          },
        ],
      });
    } else if (templatePayload.imageLink) {
      components.push({
        type: "header",
        parameters: [
          {
            type: "image",
            image: { link: templatePayload.imageLink },
          },
        ],
      });
    }

    if (Array.isArray(templatePayload.body) && templatePayload.body.length > 0) {
      components.push({
        type: "body",
        parameters: templatePayload.body.map((entry) => ({
          type: "text",
          text: String(entry),
        })),
      });
    }

    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: templatePayload.languageCode || "en",
        },
        ...(components.length > 0 ? { components } : {}),
      },
    };
  }

  private normalizeWrappedPayload(payload: any): any | null {
    if (!payload || typeof payload !== "object") {
      return null;
    }

    if (payload.messaging_product && payload.to && payload.type) {
      return payload;
    }

    const destination = payload.destination || payload.to;
    const message = payload.message || {};
    if (!destination || !message.type) {
      return null;
    }

    if (message.type === "text" && message.text) {
      return {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: this.normalizePhone(destination),
        type: "text",
        text: {
          body: String(message.text),
          preview_url: false,
        },
      };
    }

    if (message.type === "template" && message.template?.id) {
      const params = Array.isArray(message.template?.params)
        ? message.template.params
        : [];
      return {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: this.normalizePhone(destination),
        type: "template",
        template: {
          name: String(message.template.id),
          language: {
            code: "en",
          },
          ...(params.length > 0
            ? {
                components: [
                  {
                    type: "body",
                    parameters: params.map((entry: any) => ({
                      type: "text",
                      text: String(entry),
                    })),
                  },
                ],
              }
            : {}),
        },
      };
    }

    return null;
  }

  private normalizePhone(phone: string): string {
    const digits = String(phone || "").replace(/\D/g, "");
    if (!digits) {
      throw new Error("Destination phone number is required for WhatsApp message.");
    }
    return digits;
  }
}
