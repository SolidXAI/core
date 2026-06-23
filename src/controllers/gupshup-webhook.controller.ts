import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { Auth } from "src/decorators/auth.decorator";
import { Public } from "src/decorators/public.decorator";
import { AuthType } from "src/enums/auth-type.enum";

@Auth(AuthType.None)
@Controller("webhook/whatsapp/gupshup")
@ApiTags("Solid Core")
export class GupshupWebhookController {
  private readonly logger = new Logger(GupshupWebhookController.name);

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async receiveWebhook(@Req() req: Request, @Body() body: unknown) {
    const userAgent = req.headers["user-agent"] ?? null;
    this.logger.log(
      `Received Gupshup WhatsApp webhook${userAgent ? ` from ${userAgent}` : ""}`,
    );
    this.logger.debug(`Gupshup webhook payload: ${JSON.stringify(body)}`);

    const statusInfo = this.extractStatusInfo(body);
    if (statusInfo) {
      this.logger.log(
        `Gupshup delivery update: status=${statusInfo.status ?? "unknown"}, messageId=${statusInfo.messageId ?? "n/a"}, destination=${statusInfo.destination ?? "n/a"}, reason=${statusInfo.reason ?? "n/a"}`,
      );
    }

    return {
      success: true,
      message: "Webhook received",
    };
  }

  private extractStatusInfo(body: unknown): {
    status?: string;
    messageId?: string;
    destination?: string;
    reason?: string;
  } | null {
    if (!body || typeof body !== "object") {
      return null;
    }

    const payload = body as Record<string, unknown>;

    const status =
      this.asString(payload.status) ||
      this.asString(payload.messageStatus) ||
      this.asString((payload.payload as Record<string, unknown>)?.status) ||
      this.asString((payload.payload as Record<string, unknown>)?.type);

    const messageId =
      this.asString(payload.messageId) ||
      this.asString(payload.id) ||
      this.asString((payload.payload as Record<string, unknown>)?.id) ||
      this.asString((payload.payload as Record<string, unknown>)?.messageId);

    const destination =
      this.asString(payload.destination) ||
      this.asString(payload.phone) ||
      this.asString((payload.payload as Record<string, unknown>)?.destination) ||
      this.asString((payload.payload as Record<string, unknown>)?.phone);

    const reason =
      this.asString(payload.reason) ||
      this.asString(payload.error) ||
      this.asString((payload.payload as Record<string, unknown>)?.reason) ||
      this.asString((payload.payload as Record<string, unknown>)?.error);

    if (!status && !messageId && !destination && !reason) {
      return null;
    }

    return { status, messageId, destination, reason };
  }

  private asString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }
}
