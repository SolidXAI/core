import { Injectable, Logger } from '@nestjs/common';
import { SecurityRuleConfig } from 'src/dtos/security-rule-config.dto';
import { CommonEntity } from 'src/entities/common.entity';
import { SecurityRule } from 'src/entities/security-rule.entity';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { ActiveUserData } from 'src/interfaces/active-user-data.interface';
import { CrudHelperService } from 'src/services/crud-helper.service';
import { DataSource, In, Repository, SelectQueryBuilder } from 'typeorm';

@Injectable()
export class SecurityRuleRepository extends Repository<SecurityRule> {
    private readonly logger = new Logger(SecurityRuleRepository.name);
    constructor(
        private dataSource: DataSource,
        private readonly solidRegistry: SolidRegistry,
        private readonly crudHelperService: CrudHelperService
    ) {
        super(SecurityRule, dataSource.createEntityManager());
    }

    async findByModelSingularNameAndRoles(modelSingularName: string, roles: string[]): Promise<SecurityRule[]> {
        return await this.find({
            where: {
                modelMetadata: {
                    singularName: modelSingularName,
                },
                role: {
                    name: In(roles),
                },
            },
        });
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
}