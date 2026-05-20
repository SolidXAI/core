import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { AxiosError } from 'axios';
import { QueueMessage } from 'src/interfaces/mq';
import { IWhatsAppTransport } from '../../interfaces';
import { WhatsAppProvider } from 'src/decorators/whatsapp-provider.decorator';

@Injectable()
@WhatsAppProvider()
export class GupshupWhatsappService implements IWhatsAppTransport {
  readonly logger = new Logger(GupshupWhatsappService.name);

  constructor(private readonly httpService: HttpService) {}

  async sendWhatsAppMessage(
    to: string,
    templateId: string,
    parameters: any,
    parentEntity?: any,
    parentEntityId?: any,
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

    await this.sendWhatsAppMessageSynchronously(message);
    return message;
  }

  async sendWhatsAppMessageSynchronously(message: QueueMessage<any>): Promise<void> {
    const requestBody = this.createWhatsappRequest(message);

    const apiKey =
      process.env.COMMON_GUPSHUP_WHATSAPP_API_KEY || process.env.GUPSHUP_API_KEY;
    const url =
      process.env.COMMON_GUPSHUP_WHATSAPP_API_URL || process.env.GUPSHUP_API_URL;

    if (!apiKey || !url) {
      throw new Error('Missing Gupshup configuration: API key or URL');
    }

    const isWaEndpoint = url.includes('/wa/api/v1/msg');

    try {
      if (isWaEndpoint) {
        const form = this.toWaFormEncoded(requestBody);
        await this.httpService.axiosRef.post(url, form.toString(), {
          headers: {
            apikey: apiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
      } else {
        await this.httpService.axiosRef.post(url, requestBody, {
          headers: {
            apikey: apiKey,
            'Content-Type': 'application/json',
          },
        });
      }

      this.logger.debug(
        `Sent Gupshup WhatsApp message to ${message.payload.to} using ${isWaEndpoint ? 'wa' : 'json'} endpoint`,
      );
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const responseData = axiosError.response?.data;

      this.logger.error(
        `Gupshup send failed: status=${status ?? 'unknown'}, url=${url}, response=${typeof responseData === 'object' ? JSON.stringify(responseData) : responseData}`,
      );

      throw error;
    }
  }

  private createWhatsappRequest(message: QueueMessage<any>): any {
    const { to, templateId, ...parameters } = message.payload;
    const source =
      process.env.COMMON_GUPSHUP_WHATSAPP_SOURCE || process.env.GUPSHUP_SOURCE_NUMBER;

    if (parameters?.payload) {
      return parameters.payload;
    }

    return {
      channel: 'whatsapp',
      source,
      destination: to,
      message: {
        type: 'template',
        template: {
          id: templateId,
          params: parameters,
        },
      },
    };
  }

  private toWaFormEncoded(payload: Record<string, any>): URLSearchParams {
    const params = new URLSearchParams();
    const appName = process.env.COMMON_GUPSHUP_APP_NAME || 'solidx';

    params.append('channel', payload.channel || 'whatsapp');
    params.append('source', payload.source || '');
    params.append('destination', payload.destination || '');
    params.append('src.name', payload['src.name'] || appName);
    params.append('message', JSON.stringify(payload.message || {}));

    return params;
  }
}
