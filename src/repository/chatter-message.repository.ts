import { camelize, classify } from "@angular-devkit/core/src/utils/strings";
import { Injectable } from "@nestjs/common";
import { ChatterMessage } from "src/entities/chatter-message.entity";
import { ActiveUserData } from "src/interfaces/active-user-data.interface";
import { RequestContextService } from "src/services/request-context.service";
import { DataSource, QueryRunner, SelectQueryBuilder } from "typeorm";
import { SecurityRuleRepository } from "./security-rule.repository";
import { SolidBaseRepository } from "./solid-base.repository";
import {get} from "lodash"

@Injectable()
export class ChatterMessageRepository extends SolidBaseRepository<ChatterMessage> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(ChatterMessage, dataSource, requestContextService, securityRuleRepository);
    }

    private readonly CO_MODEL_NAME_PATH = 'filters.coModelName.$eq';
    override createQueryBuilder(alias?: string, queryRunner?: QueryRunner): SelectQueryBuilder<ChatterMessage> {
        const activeUserOrUndefined = this.requestContextService.getActiveUser();
        let qb = super.createQueryBuilder(alias, queryRunner);
        if (!activeUserOrUndefined) return qb;
        
        //Left join on the associated chatter model entity
        const [coModelName, coModelAlias] = this.getCoModelNameAndAlias();
        if (!coModelName) return qb;
        qb = this.leftJoinCoModel(qb, coModelName);
        
        return this.securityRuleRepository.applySecurityRules(
            qb,
            coModelName,
            activeUserOrUndefined as ActiveUserData,
            coModelAlias
        );
    }

    private leftJoinCoModel<ChatterMessage>(
        qb: SelectQueryBuilder<ChatterMessage>,
        coModelName: string
    ) {
        // const Target = resolveEntityFromCoModelName(coModelName); // your mapping
        const entityName = classify(coModelName)
        const meta = this.dataSource.getMetadata(entityName);
        const alias = camelize(meta.name);
        qb.leftJoin(
            entityName,
            alias,
            // `${alias}.id = entity.co_model_entity_id`,
            `${alias}.id = entity.co_model_entity_id AND entity.co_model_name = :model`,
            { model: coModelName }
        );
        return qb;
        // return qb.leftJoin(Target, alias, `${alias}.id = entity.co_model_entity_id`);
    }

    // This uses the requestContextService.getRequestFilter method and extracts the coModelName and creates the alias and returns the name and alias tuple
    private getCoModelNameAndAlias() {
        const requestFilter = this.requestContextService.getRequestFilter();
        if (!requestFilter) return [undefined, undefined];

        const coModelName = get(requestFilter, this.CO_MODEL_NAME_PATH);
        if (!coModelName) return [undefined, undefined];
        const alias = camelize(coModelName);
        return [coModelName, alias];
    }

}