import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { UserDeviceMetadata } from "src/entities/user-device-metadata.entity";
import { RequestContextService } from "src/services/request-context.service";
import { SecurityRuleRepository } from "./security-rule.repository";
import { SolidBaseRepository } from "./solid-base.repository";

// for solid-core
@Injectable()
export class UserDeviceMetadataRepository extends SolidBaseRepository<UserDeviceMetadata> {
  constructor(
    readonly dataSource: DataSource,
    readonly requestContextService: RequestContextService,
    readonly securityRuleRepository: SecurityRuleRepository,
  ) {
    super(
      UserDeviceMetadata,
      dataSource,
      requestContextService,
      securityRuleRepository,
    );
  }
}
