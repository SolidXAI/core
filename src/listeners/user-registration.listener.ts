import { User } from "../entities/user.entity";
import { OnEvent } from "@nestjs/event-emitter";
import { Injectable, Logger } from "@nestjs/common";
import { EventDetails, EventType } from "../interfaces";
import { WhatsAppFactory } from "src/factories/whatsapp.factory";

@Injectable()
export class UserRegistrationListener {
  private readonly logger = new Logger(UserRegistrationListener.name);

  constructor(private readonly whatsAppFactory: WhatsAppFactory) {}

  @OnEvent(EventType.USER_REGISTERED)
  async handleUserRegistration(event: EventDetails<User>) {
    this.logger.log(`User registered with details: ${JSON.stringify(event.payload)}`);

    const notifyTo = process.env.WHATSAPP_EVENT_NOTIFY_TO;
    if (!notifyTo) {
      this.logger.debug("WHATSAPP_EVENT_NOTIFY_TO not set. Skipping registration WhatsApp notification.");
      return;
    }

    try {
      const whatsappService = this.whatsAppFactory.getWhatsappService();
      const username = event.payload?.username || "User";
      const userId = event.payload?.id || "N/A";

      await whatsappService.sendWhatsAppMessage(
        notifyTo,
        "registration_event",
        {
          payload: {
            channel: "whatsapp",
            source: process.env.COMMON_GUPSHUP_WHATSAPP_SOURCE,
            destination: notifyTo,
            "src.name": process.env.COMMON_GUPSHUP_APP_NAME || "solidx",
            message: {
              type: "text",
              text: `New user registered: ${username} (id: ${userId})`,
            },
          },
        },
      );

      this.logger.log(`Sent registration WhatsApp notification to ${notifyTo}`);
    } catch (error: any) {
      const status = error?.response?.status;
      const responseData = error?.response?.data;
      const errorMessage = error?.message;
      const stack = error?.stack;

      this.logger.error(
        `Failed to send registration WhatsApp notification to ${notifyTo}. status=${status ?? "unknown"}, response=${typeof responseData === "object" ? JSON.stringify(responseData) : responseData}, message=${errorMessage}, stack=${stack}`,
      );
    }
  }
}
