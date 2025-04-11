import { Injectable, Logger } from '@nestjs/common';
import { SecurityRuleConfig } from 'src/dtos/security-rule-config.dto';
import { UpdateSecurityRuleDto } from 'src/dtos/update-security-rule.dto';
import { CommonEntity } from 'src/entities/common.entity';
import { SecurityRule } from 'src/entities/security-rule.entity';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { ActiveUserData } from 'src/interfaces/active-user-data.interface';
import { CrudHelperService } from 'src/services/crud-helper.service';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';

@Injectable()
export class SecurityRuleRepository extends Repository<SecurityRule> {
    private readonly logger = new Logger(SecurityRuleRepository.name);
    constructor(
        private dataSource: DataSource,
        private readonly solidRegistry: SolidRegistry,
        private readonly crudHelperService: CrudHelperService,
    ) {
        super(SecurityRule, dataSource.createEntityManager());
    }

    applySecurityRules<T extends CommonEntity>(qb: SelectQueryBuilder<T>, modelSingularName: string, activeUser: ActiveUserData,): SelectQueryBuilder<T> {
        // Fetch the security rules for the model and roles
        const securityRules = this.solidRegistry.getSecurityRules(modelSingularName, activeUser.roles);

        // Loop through the security rules and add only rules that are json parseable and have a rule
        securityRules.forEach((rule: SecurityRule) => {
            try {
                // Parse the security rule and call the buildFilter method to build the query from the security rule
                const parsedRule = JSON.parse(this.resolveSecurityRuleConfig(rule.securityRuleConfig, activeUser)) as SecurityRuleConfig;
                if (parsedRule && parsedRule.filters) {
                    this.crudHelperService.buildFilterQuery(qb, parsedRule, qb.alias);
                }
            } catch (error) {
                this.logger.warn(`Error parsing security rule: ${rule.securityRuleConfig}`, error);
            }
        });

        return qb;
    }


    private resolveSecurityRuleConfig(configString: string, activeUser: ActiveUserData) {
        return configString.replace('$activeUserId', activeUser.sub.toString());
    }

    async toDto(securityRule: SecurityRule): Promise<UpdateSecurityRuleDto> {
        // load the role and model relations for the security rule
        let populatedSecurityRule: SecurityRule = securityRule;
        // If the security rule does not have the role and model relations loaded, load them
        if (!securityRule.role || !securityRule.modelMetadata) {
            populatedSecurityRule = await this.findOne({
                where: {
                    id: securityRule.id,
                },
                relations: {
                    role: true,
                    modelMetadata: true,
                },
            });
        }

        return {
            id: populatedSecurityRule.id,
            name: populatedSecurityRule.name,
            description: populatedSecurityRule.description,
            roleId: populatedSecurityRule.role.id,
            roleUserKey: populatedSecurityRule.role.name,
            modelMetadataId: populatedSecurityRule.modelMetadata.id,
            modelMetadataUserKey: populatedSecurityRule.modelMetadata.singularName,
            securityRuleConfig: populatedSecurityRule.securityRuleConfig,
        };
    }
}