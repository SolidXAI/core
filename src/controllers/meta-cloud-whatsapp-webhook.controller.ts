import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { Auth } from "src/decorators/auth.decorator";
import { Public } from "src/decorators/public.decorator";
import { AuthType } from "src/enums/auth-type.enum";
import { SettingService } from "src/services/setting.service";
import type { SolidCoreSetting } from "src/services/settings/default-settings-provider.service";

@Auth(AuthType.None)
@Controller("webhook/whatsapp/meta-cloud")
@ApiTags("Solid Core")
export class MetaCloudWhatsappWebhookController {
  private readonly logger = new Logger(MetaCloudWhatsappWebhookController.name);

  constructor(private readonly settingService: SettingService) {}

  @Public()
  @Get()
  verifyWebhook(@Query() query: Record<string, unknown>, @Res() res: Response) {
    const mode = this.resolveQueryValue(query, "hub.mode", "hub_mode", "mode");
    const verifyToken = this.resolveQueryValue(
      query,
      "hub.verify_token",
      "hub_verify_token",
      "verify_token",
    );
    const challenge = this.resolveQueryValue(
      query,
      "hub.challenge",
      "hub_challenge",
      "challenge",
    );

    const configuredVerifyToken =
      this.settingService.getConfigValue<SolidCoreSetting>(
        "metaWhatsappWebhookVerifyToken",
      ) || process.env.COMMON_META_WHATSAPP_WEBHOOK_VERIFY_TOKEN;

    const isVerificationCall = mode === "subscribe";
    const tokenMatches =
      !!configuredVerifyToken && verifyToken === configuredVerifyToken;

    if (isVerificationCall && tokenMatches && challenge) {
      this.logger.log("Meta Cloud WhatsApp webhook verified successfully.");
      res.writeHead(HttpStatus.OK, {
        "Content-Type": "text/plain",
        "Content-Length": Buffer.byteLength(String(challenge)),
      });
      res.write(String(challenge));
      return res.end();
    }

    this.logger.warn(
      `Meta Cloud webhook verification failed. mode=${mode ?? "n/a"}, tokenMatch=${tokenMatches}`,
    );

    res.writeHead(HttpStatus.FORBIDDEN, { "Content-Type": "text/plain" });
    return res.end("Webhook verification failed");
  }

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async receiveWebhook(@Body() body: unknown) {
    this.logger.log("Received Meta Cloud WhatsApp webhook");
    this.logger.debug(`Meta Cloud webhook payload: ${JSON.stringify(body)}`);

    const statusInfo = this.extractStatusInfo(body);
    if (statusInfo) {
      this.logger.log(
        `Meta Cloud delivery update: status=${statusInfo.status ?? "unknown"}, messageId=${statusInfo.messageId ?? "n/a"}, destination=${statusInfo.destination ?? "n/a"}, reason=${statusInfo.reason ?? "n/a"}`,
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
    const entries = payload.entry as Array<Record<string, unknown>> | undefined;
    const changes = entries?.[0]?.changes as Array<Record<string, unknown>> | undefined;
    const value = changes?.[0]?.value as Record<string, unknown> | undefined;
    const statuses = value?.statuses as Array<Record<string, unknown>> | undefined;
    const status = statuses?.[0];

    if (!status) {
      return null;
    }

    const errors = status.errors as Array<Record<string, unknown>> | undefined;

    return {
      status: this.asString(status.status),
      messageId: this.asString(status.id),
      destination: this.asString(status.recipient_id),
      reason:
        this.asString(errors?.[0]?.title) || this.asString(errors?.[0]?.message),
    };
  }

  private asString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private resolveQueryValue(
    query: Record<string, unknown>,
    ...keys: string[]
  ): string | undefined {
    for (const key of keys) {
      const directValue = this.asString(query[key]);
      if (directValue) {
        return directValue;
      }
    }

    const hubRaw = query.hub;
    if (hubRaw && typeof hubRaw === "object" && !Array.isArray(hubRaw)) {
      const hub = hubRaw as Record<string, unknown>;
      for (const key of ["mode", "verify_token", "challenge"]) {
        const value = this.asString(hub[key]);
        if (
          value &&
          keys.some((candidate) => candidate.endsWith(key) || candidate === key)
        ) {
          return value;
        }
      }
    }

    return undefined;
  }
}
