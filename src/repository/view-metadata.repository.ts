import { Injectable } from "@nestjs/common";
import { ViewMetadata } from "src/entities/view-metadata.entity";
import { RequestContextService } from "src/services/request-context.service";
import { DataSource } from "typeorm";
import { SecurityRuleRepository } from "./security-rule.repository";
import { SolidBaseRepository } from "./solid-base.repository";

@Injectable()
export class ViewMetadataRepository extends SolidBaseRepository<ViewMetadata> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(ViewMetadata, dataSource, requestContextService, securityRuleRepository);
    }

    // Custom repository methods can be added here if needed
    async findByNameAndModelNameAndModuleName(name: string, modelUserKey: string, moduleUserKey: string): Promise<ViewMetadata | null> {
        const viewMetadata = await this.findOne({
            where: {
                name,
                model: {
                    singularName: modelUserKey,
                    module: {
                        name: moduleUserKey
                    }
                }
            }
        });
        return viewMetadata;
    }

    async findByTypeModelNameAndModuleName(type: string, modelUserKey: string, moduleUserKey: string): Promise<ViewMetadata | null> {
        const viewMetadata = await this.findOne({
            where: {
                type: type,
                model: {
                    singularName: modelUserKey,
                    module: {
                        name: moduleUserKey
                    }
                }
            }
        });
        return viewMetadata;
    }
}
