import { Injectable, Logger } from '@nestjs/common';
import { CommonEntity } from 'src/entities/common.entity';
import { SecurityRule } from 'src/entities/security-rule.entity';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { ActiveUserData } from 'src/interfaces/active-user-data.interface';
import { DataSource, In, Repository, SelectQueryBuilder } from 'typeorm';

interface SecurityQueryRule {
    userIdFieldPath: string;
}

@Injectable()
export class SecurityRuleRepository extends Repository<SecurityRule> {
    private readonly logger = new Logger(SecurityRuleRepository.name);
    constructor(
        private dataSource: DataSource,
        private readonly solidRegistry: SolidRegistry,
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

        // Extract the actual security query rules from the security rules
        const securityQueryRules = [];
        // Loop through the security rules and add only rules that are json parseable and have a rule
        securityRules.forEach((rule: SecurityRule) => {
            try {
                const parsedRule = JSON.parse(rule.securityRule) as SecurityQueryRule;
                if (parsedRule && parsedRule.userIdFieldPath) {
                    securityQueryRules.push(`${qb.alias}.${parsedRule.userIdFieldPath}`);
                }
            } catch (error) {
                this.logger.warn(`Error parsing security rule: ${rule.securityRule}`, error);
            }
        });

        // Loop through the security rules and apply them to the query builder
        securityQueryRules.forEach((rule: SecurityRule) => {
            const ruleString = `${rule} = :activeUserId`;
            qb.andWhere(ruleString, { activeUserId: activeUser.sub });
        });
        return qb;
    }

}