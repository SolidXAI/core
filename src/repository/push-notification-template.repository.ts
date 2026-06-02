import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { RequestContextService } from "src/services/request-context.service";
import { SecurityRuleRepository } from "./security-rule.repository";
import { SolidBaseRepository } from "./solid-base.repository";
import { PushNotificationTemplate } from "src/entities/push-notification-template.entity";

@Injectable()
export class PushNotificationTemplateRepository extends SolidBaseRepository<PushNotificationTemplate> {
  constructor(
    readonly dataSource: DataSource,
    readonly requestContextService: RequestContextService,
    readonly securityRuleRepository: SecurityRuleRepository,
  ) {
    super(
      PushNotificationTemplate,
      dataSource,
      requestContextService,
      securityRuleRepository,
    );
  }
}
