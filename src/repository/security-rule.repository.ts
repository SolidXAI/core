import { Injectable } from '@nestjs/common';
import { SecurityRule } from 'src/entities/security-rule.entity';
import { DataSource, In, Repository } from 'typeorm';

@Injectable()
export class SecurityRuleRepository extends Repository<SecurityRule>  {
    private readonly loadedSecurityRules: SecurityRule[];
    constructor(
        private dataSource: DataSource,
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
}