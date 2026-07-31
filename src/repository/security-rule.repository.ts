import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateSecurityRuleDto } from 'src/dtos/create-security-rule.dto';
import { SecurityRuleConfig } from 'src/dtos/security-rule-config.dto';
import { UpdateSecurityRuleDto } from 'src/dtos/update-security-rule.dto';
import { CommonEntity } from 'src/entities/common.entity';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { RoleMetadata } from 'src/entities/role-metadata.entity';
import { SecurityRule } from 'src/entities/security-rule.entity';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { ActiveUserData } from 'src/interfaces/active-user-data.interface';
import { CrudHelperService } from 'src/services/crud-helper.service';
import { Brackets, DataSource, SelectQueryBuilder } from 'typeorm';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class SecurityRuleRepository extends SolidBaseRepository<SecurityRule> {
    constructor(
        readonly dataSource: DataSource,
        // readonly requestContextService: RequestContextService,
        readonly solidRegistry: SolidRegistry,
        readonly crudHelperService: CrudHelperService,
    ) {
        super(SecurityRule, dataSource, null, null);
    }

    async applySecurityRules<T extends CommonEntity>(qb: SelectQueryBuilder<T>, modelSingularName: string, activeUser: ActiveUserData, securityRuleAlias: string = qb.alias): Promise<SelectQueryBuilder<T>> {
        // Fetch the security rules for the model and roles
        const securityRules = this.solidRegistry.getSecurityRules(modelSingularName, activeUser.roles);

        // If no security rules, return the original query builder
        if (!securityRules.length) {
            return qb;
        }

        const evaluatedRules = [];

        for (const rule of securityRules) {

            let evaluatedRule = null;

            try {
                // First check if the rule has a "dynamic" security rule config provider. 
                if (rule.securityRuleConfigProvider) {
                    // TODO: Evaluation of the securityRuleConfig Provider should happen outside first...
                    const securityRuleConfigProviderInstance = this.solidRegistry.getSecurityRuleConfigProviderInstance(rule.securityRuleConfigProvider);
                    if (!securityRuleConfigProviderInstance) {
                        throw new Error(`Unable to resolve instance for security rule config provider: ${rule.securityRuleConfigProvider}`);
                    }
                    evaluatedRule = await securityRuleConfigProviderInstance.securityRuleConfig(activeUser, rule);
                }
                else {
                    evaluatedRule = JSON.parse(
                        this.resolveSecurityRuleConfig(rule.securityRuleConfig, activeUser)
                    ) as SecurityRuleConfig;
                }

                evaluatedRules.push(evaluatedRule);

            } catch (error: any) {
                this.logger.error(`Error parsing security rule: ${rule.securityRuleConfig}`, error);
                this.logger.error(error.stack);
                throw error;
            }
        }


        // A rule whose filters contribute no conditions is dangerous here: TypeORM renders an empty
        // Brackets as "1=1" (always true), so such a rule would be OR'd in as "match everything" and
        // silently void the entire security filter. Test emptiness explicitly -- {} and [] are both
        // truthy, so the previous `if (evaluatedRule.filters)` check let them through.
        const applicableRules = evaluatedRules.filter(rule => rule && this.hasFilterConditions(rule.filters));

        if (!applicableRules.length) {
            // We only reach here when security rules exist for this model/role (there is an early
            // return above otherwise), so a restriction WAS intended. Fail closed and be loud:
            // denying silently would surface as a mysteriously empty list, and allowing would be a
            // full row-level-security bypass.
            const message = `Security rules for model '${modelSingularName}' produced no filter conditions. `
                + `Check the securityRuleConfig / securityRuleConfigProvider for rules with empty filters. `
                + `Denying access rather than returning unrestricted results.`;
            this.logger.error(message);
            throw new InternalServerErrorException(message);
        }

        // Apply each security rule to the query builder. The rules are combined with OR logic at the top level.
        qb.andWhere(new Brackets((outerQb) => {
            for (const evaluatedRule of applicableRules) {
                outerQb.orWhere( // combine each rule-group with OR at the outer level
                    new Brackets((innerQb) => {
                        // NOTE: do NOT wrap this in try/catch. Field validation inside applyFilters
                        // throws on an invalid rule field, and letting it propagate aborts the
                        // request with no rows -- i.e. it fails closed. Swallowing it would leave
                        // this Brackets empty, which TypeORM renders as "1=1", turning the rule into
                        // "match everything" and voiding row-level security entirely.
                        this.crudHelperService.applyFilters(innerQb, evaluatedRule.filters, securityRuleAlias, qb); // AND within a rule
                    })
                );
            }
        }));

        return qb;
    }

    private resolveSecurityRuleConfig(configString: string, activeUser: ActiveUserData) {
        return configString.replace('$activeUserId', activeUser.sub.toString());
    }

    /**
     * Does this filter object actually produce at least one WHERE condition?
     *
     * Truthiness is not enough: `{}` and `[]` are truthy but contribute nothing, and an empty
     * Brackets is rendered by TypeORM as "1=1" -- which inside the security rules' OR chain means
     * "match every row". Recurses through $and/$or so `{ $and: [] }` is treated as empty too.
     */
    private hasFilterConditions(filters: any): boolean {
        if (filters === null || filters === undefined) return false;
        if (Array.isArray(filters)) return filters.some(filter => this.hasFilterConditions(filter));
        if (typeof filters !== 'object') return false;

        return Object.keys(filters).some(key => {
            const normalizedKey = key.replace(/^\[(.*)\]$/, '$1');
            if (normalizedKey === '$and' || normalizedKey === '$or') {
                return this.hasFilterConditions(filters[key]);
            }
            return true; // any other key is a field condition
        });
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
            securityRuleConfigProvider: populatedSecurityRule.securityRuleConfigProvider,
        };
    }

    async upsertWithDto(createDto: CreateSecurityRuleDto) {
        // Populate the role from roleId or roleUserKey
        const roleRepository = this.dataSource.getRepository(RoleMetadata);
        if (createDto.roleId) {
            const role = await roleRepository.findOne({
                where: {
                    id: createDto.roleId,
                },
            });
            createDto['role'] = role;
        }

        if (createDto.roleUserKey) {
            const role = await roleRepository.findOne({
                where: {
                    name: createDto.roleUserKey,
                },
            });
            createDto['role'] = role;
        }

        // Populate the model from modelMetadataId or modelMetadataUserKey
        const modelMetadataRepository = this.dataSource.getRepository(ModelMetadata);
        if (createDto.modelMetadataId) {
            const modelMetadata = await modelMetadataRepository.findOne({
                where: {
                    id: createDto.modelMetadataId,
                },
            });
            createDto['modelMetadata'] = modelMetadata;
        }
        if (createDto.modelMetadataUserKey) {
            const modelMetadata = await modelMetadataRepository.findOne({
                where: {
                    singularName: createDto.modelMetadataUserKey,
                },
            });
            createDto['modelMetadata'] = modelMetadata;
        }

        // First check if module already exists using name
        const existingSecurityRule = await this.findOne({
            where: {
                name: createDto.name,
            },
        });

        if (existingSecurityRule) {
            const updatedSecurityRule = this.merge(existingSecurityRule, createDto);
            return this.save(updatedSecurityRule);
        }
        else {
            const securityRule = this.create(createDto);
            return this.save(securityRule);
        }
    }

}