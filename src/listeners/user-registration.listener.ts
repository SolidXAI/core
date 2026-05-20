import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { AxiosError } from "axios";
import { WhatsAppFactory } from "src/factories/whatsapp.factory";
import { EventDetails, EventType } from "../interfaces";
import { User } from "../entities/user.entity";

@Injectable()
export class UserRegistrationListener {
  private readonly logger = new Logger(UserRegistrationListener.name);

  constructor(private readonly whatsAppFactory: WhatsAppFactory) {}

  @OnEvent(EventType.USER_REGISTERED)
  async handleUserRegistration(event: EventDetails<User>) {
    this.logger.log(`User registered with details: ${JSON.stringify(event.payload)}`);

    const to =
      process.env.WHATSAPP_EVENT_NOTIFY_TO ||
      process.env.COMMON_WHATSAPP_EVENT_NOTIFY_TO;

    if (!to) {
      this.logger.debug(
        "Skipping WhatsApp registration notification. Set WHATSAPP_EVENT_NOTIFY_TO or COMMON_WHATSAPP_EVENT_NOTIFY_TO.",
      );
      return;
    }

    const userName = event?.payload?.username || event?.payload?.email || "User";

    try {
      const whatsappService = this.whatsAppFactory.getWhatsappService();
      await whatsappService.sendWhatsAppMessage(to, null, {
        payload: {
          channel: "whatsapp",
          source:
            process.env.COMMON_GUPSHUP_WHATSAPP_SOURCE ||
            process.env.GUPSHUP_SOURCE_NUMBER,
          destination: to,
          "src.name": process.env.COMMON_GUPSHUP_APP_NAME || "solidx",
          message: {
            type: "text",
            text: `New user registered: ${userName}`,
          },
        },
      });

      this.logger.log(`Sent registration WhatsApp notification to ${to}`);
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const responseData = axiosError.response?.data;
      const genericError = error as Error;

      this.logger.error(
        `Failed to send registration WhatsApp notification to ${to}. status=${status ?? 'unknown'}, response=${typeof responseData === 'object' ? JSON.stringify(responseData) : responseData}, message=${genericError?.message ?? 'unknown'}, stack=${genericError?.stack ?? 'n/a'}`,
      );
    }
  }
}
