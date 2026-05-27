import {
  Content,
  Destination,
  Message,
  SendEmailCommand,
  SESClient,
} from "@aws-sdk/client-ses";

import { SettingService } from "../setting.service";
import { Injectable, Logger } from "@nestjs/common";
import { IMail, MailAttachment, MailAttachmentWrapper } from "src/interfaces";
import { QueueMessage } from "src/interfaces/mq";
import { MailProvider } from "src/decorators/mail-provider.decorator";
import { EmailTemplateService } from "../email-template.service";
import Handlebars from "handlebars";
import { SolidCoreSetting } from "../settings/default-settings-provider.service";
import { PublisherFactory } from "../queues/publisher-factory.service";

@Injectable()
@MailProvider()
export class AmazonSESService implements IMail {
  private readonly logger = new Logger(AmazonSESService.name);
  private getSESClient(): SESClient {
    return new SESClient({
      region:
        this.settingService.getConfigValue<SolidCoreSetting>("awsSesRegion"),

      credentials: {
        accessKeyId:
          this.settingService.getConfigValue<SolidCoreSetting>(
            "awsSesAccessKeyId",
          ),

        secretAccessKey: this.settingService.getConfigValue<SolidCoreSetting>(
          "awsSesSecretAccessKey",
        ),
      },
    });
  }

  constructor(
    private readonly publisherFactory: PublisherFactory<any>,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly settingService: SettingService,
  ) {}

  async sendEmailUsingTemplate(
    to: string,
    templateName: string,
    templateParams: any,
    shouldQueueEmails = false,
    wrapperAttachments?: MailAttachmentWrapper[],
    attachments?: MailAttachment[],
    parentEntity?: any,
    parentEntityId?: any,
    cc?: string[],
    bcc?: string[],
    from?: string,
  ): Promise<unknown> {
    const emailTemplate =
      await this.emailTemplateService.findOneByName(templateName);
    if (!emailTemplate) {
      throw new Error(`Invalid template name ${templateName}`);
    }

    const bodyTemplate = Handlebars.compile(emailTemplate.body);
    const body = bodyTemplate(templateParams);

    const subjectTemplate = Handlebars.compile(emailTemplate.subject);
    const subject = subjectTemplate(templateParams);

    return this.sendEmail(
      to,
      subject,
      body,
      shouldQueueEmails,
      wrapperAttachments,
      attachments,
      parentEntity,
      parentEntityId,
      cc,
      bcc,
      from,
    );
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string,
    shouldQueueEmails = false,
    wrapperAttachments?: MailAttachmentWrapper[],
    attachments?: MailAttachment[],
    _parentEntity?: any,
    _parentEntityId?: any,
    cc?: string[],
    bcc?: string[],
    from?: string,
  ): Promise<unknown> {
    const message: QueueMessage<any> = {
      payload: {
        from:
          from ||
          this.settingService.getConfigValue<SolidCoreSetting>("sesMailFrom") ||
          this.settingService.getConfigValue<SolidCoreSetting>("smtpMailFrom"),
        to,
        subject,
        body,
        cc,
        bcc,
        wrapperAttachments,
        attachments,
      },
      parentEntity: _parentEntity,
      parentEntityId: _parentEntityId,
    };

    if (shouldQueueEmails === true) {
      return this.sendEmailAsynchronously(message);
    } else if (
      shouldQueueEmails === false &&
      this.settingService.getConfigValue<SolidCoreSetting>("shouldQueueEmails") ===
        true
    ) {
      return this.sendEmailAsynchronously(message);
    }

    return this.sendEmailSynchronously(message);
  }

  async sendEmailAsynchronously(message: QueueMessage<any>): Promise<string> {
    const { to, subject } = message.payload;
    this.logger.debug(`Queueing SES email to ${to} with subject ${subject}`);
    return this.publisherFactory.publish(message, "AmazonSesEmailQueuePublisher");
  }

  async sendEmailSynchronously(message: QueueMessage<any>): Promise<unknown> {
    const { from, to, subject, body, cc, bcc, attachments, wrapperAttachments } =
      message.payload;

    if (
      (attachments && attachments.length > 0) ||
      (wrapperAttachments && wrapperAttachments.length > 0)
    ) {
      this.logger.warn(
        "SES basic implementation currently ignores attachments. Email will be sent without attachments.",
      );
    }

    if (!from || !to || !subject || !body) {
      this.logger.error(
        "Required SES email fields are missing. Ensure from/to/subject/body are present.",
      );
      return;
    }

    const command = new SendEmailCommand({
      Source: from,
      Destination: this.buildDestination(to, cc, bcc),
      Message: this.buildMessage(subject, body),
    });

    try {
      const sesClient = this.getSESClient();

      const response = await sesClient.send(command);

      this.logger.log(
        `SES email sent successfully to ${to}. MessageId=${response.MessageId}`,
      );

      return response;
    } catch (error) {
      this.logger.error(`Failed to send SES email to ${to}`, error);

      throw error;
    }
  }

  private buildDestination(
    to: string,
    cc?: string[],
    bcc?: string[],
  ): Destination {
    return {
      ToAddresses: [to],
      CcAddresses: cc?.filter(Boolean),
      BccAddresses: bcc?.filter(Boolean),
    };
  }

  private buildMessage(subject: string, body: string): Message {
    return {
      Subject: {
        Data: subject,
        Charset: "UTF-8",
      },
      Body: {
        Html: this.toContent(body),
      },
    };
  }

  private toContent(value: string): Content {
    return {
      Data: value,
      Charset: "UTF-8",
    };
  }
}
