import { Injectable } from "@nestjs/common";
import { User } from "src/entities/user.entity";
import { RequestContextService } from "src/services/request-context.service";
import { DataSource } from "typeorm";
import { SecurityRuleRepository } from "./security-rule.repository";
import { SolidBaseRepository } from "./solid-base.repository";

@Injectable()
export class UserRepository extends SolidBaseRepository<User> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(User, dataSource, requestContextService, securityRuleRepository);
    }
}