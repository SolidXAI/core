import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { AxiosError } from "axios";
import { WhatsAppProvider } from "src/decorators/whatsapp-provider.decorator";
import { IWhatsAppTransport } from "src/interfaces";

@Injectable()
@WhatsAppProvider()
export class GupshupOtpWhatsappService implements IWhatsAppTransport {
  private readonly logger = new Logger(GupshupOtpWhatsappService.name);

  constructor(private readonly httpService: HttpService) {}

  async sendWhatsAppMessage(
    to: string,
    templateId: string,
    parameters: any,
    parentEntity?: any,
    parentEntityId?: any,
  ): Promise<any> {
    if (!to) {
      throw new Error("WhatsApp destination number is required");
    }

    const payload = parameters?.payload;
    if (payload?.message?.type === "text" && payload?.message?.text) {
      await this.sendTextMessage(
        payload.destination || to,
        payload.message.text,
        payload.source,
        payload["src.name"],
      );
      return { to, templateId, parameters, parentEntity, parentEntityId };
    }

    if (parameters?.type === "text" && parameters?.text) {
      await this.sendTextMessage(to, parameters.text);
      return { to, templateId, parameters, parentEntity, parentEntityId };
    }

    if (!templateId) {
      throw new Error("WhatsApp templateId is required for template message");
    }

    const bodyParams = Array.isArray(parameters)
      ? parameters
      : Array.isArray(parameters?.body)
        ? parameters.body
        : [];

    await this.sendOtpTemplate(to, templateId, bodyParams.map((x) => String(x)));
    return { to, templateId, parameters, parentEntity, parentEntityId };
  }

  private async sendTextMessage(
    destination: string,
    text: string,
    sourceOverride?: string,
    appNameOverride?: string,
  ): Promise<void> {
    const apiKey =
      process.env.COMMON_GUPSHUP_WHATSAPP_API_KEY ||
      process.env.GUPSHUP_API_KEY;
    const msgUrl =
      process.env.COMMON_GUPSHUP_WHATSAPP_API_URL ||
      process.env.GUPSHUP_API_URL ||
      "https://api.gupshup.io/wa/api/v1/msg";
    const source =
      sourceOverride ||
      process.env.COMMON_GUPSHUP_WHATSAPP_SOURCE ||
      process.env.GUPSHUP_SOURCE_NUMBER;
    const appName =
      appNameOverride || process.env.COMMON_GUPSHUP_APP_NAME || "solidx";

    if (!apiKey || !msgUrl || !source) {
      throw new Error("Missing Gupshup WhatsApp configuration for text message");
    }

    const rawDestination = destination.replace(/\D/g, "");
    const params = new URLSearchParams();
    params.append("channel", "whatsapp");
    params.append("source", source);
    params.append("destination", rawDestination);
    params.append("src.name", appName);
    params.append("message", JSON.stringify({ type: "text", text }));

    await this.httpService.axiosRef.post(msgUrl, params.toString(), {
      headers: {
        apikey: apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
  }

  async sendOtpTemplate(
    destination: string,
    templateId: string,
    bodyParams: string[],
  ): Promise<void> {
    const apiKey =
      process.env.COMMON_GUPSHUP_WHATSAPP_API_KEY ||
      process.env.GUPSHUP_API_KEY;
    const baseUrl =
      process.env.COMMON_GUPSHUP_WHATSAPP_API_URL ||
      process.env.GUPSHUP_API_URL ||
      "https://api.gupshup.io/wa/api/v1/msg";
    const templateUrl =
      process.env.COMMON_GUPSHUP_WHATSAPP_TEMPLATE_API_URL ||
      baseUrl.replace(/\/msg$/, "/template/msg");
    const source =
      process.env.COMMON_GUPSHUP_WHATSAPP_SOURCE ||
      process.env.GUPSHUP_SOURCE_NUMBER;
    const appName = process.env.COMMON_GUPSHUP_APP_NAME || "solidx";

    if (!apiKey || !templateUrl || !source) {
      throw new Error("Missing Gupshup OTP WhatsApp configuration");
    }

    if (!destination || !String(destination).trim()) {
      throw new Error("WhatsApp destination is empty");
    }

    try {
      const rawDestination = destination.replace(/\D/g, "");
      const params = new URLSearchParams();
      params.append("channel", "whatsapp");
      params.append("source", source);
      params.append("destination", rawDestination);
      params.append(
        "to",
        rawDestination.startsWith("+")
          ? rawDestination
          : `+${rawDestination}`,
      );
      params.append("src.name", appName);
      params.append(
        "template",
        JSON.stringify({
          id: templateId,
          params: bodyParams,
        }),
      );

      this.logger.debug(
        `Gupshup OTP outbound (template): endpoint=${templateUrl}, source=${source}, destination=${rawDestination}, to=${rawDestination.startsWith("+") ? rawDestination : `+${rawDestination}`}, templateId=${templateId}, params=${JSON.stringify(bodyParams)}`,
      );

      const response = await this.httpService.axiosRef.post(
        templateUrl,
        params.toString(),
        {
          headers: {
            apikey: apiKey,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      this.logger.debug(
        `Gupshup response: ${response.status}, data=${JSON.stringify(response.data)}`,
      );

      this.logger.debug(
        `Independent OTP WhatsApp sent to ${rawDestination} template=${templateId} via template endpoint`,
      );
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `Independent OTP WhatsApp failed: destination=${destination}, templateId=${templateId}, status=${axiosError.response?.status ?? "unknown"}, response=${typeof axiosError.response?.data === "object" ? JSON.stringify(axiosError.response?.data) : axiosError.response?.data}, url=${templateUrl}`,
      );
      throw error;
    }
  }
}
