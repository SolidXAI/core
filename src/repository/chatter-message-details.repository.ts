import { Injectable } from '@nestjs/common';
import {
  DataSource,
  QueryRunner,
  SelectQueryBuilder,
} from 'typeorm';
import { camelize, classify } from '@angular-devkit/core/src/utils/strings';

import { ChatterMessageDetails } from 'src/entities/chatter-message-details.entity';
import { ActiveUserData } from 'src/interfaces/active-user-data.interface';
import { RequestContextService } from 'src/services/request-context.service';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';
import {get} from "lodash"


@Injectable()
export class ChatterMessageDetailsRepository extends SolidBaseRepository<ChatterMessageDetails> {
  constructor(
    readonly dataSource: DataSource,
    readonly requestContextService: RequestContextService,
    readonly securityRuleRepository: SecurityRuleRepository,
  ) {
    super(ChatterMessageDetails, dataSource, requestContextService, securityRuleRepository);
  }
    private readonly CO_MODEL_NAME_PATH = 'filters.chatterMessage.coModelName.$eq';

  /**
   * Build a security-aware QB:
   *  - join the real relation to ChatterMessage (alias: "message")
   *  - left join the polymorphic co-model table using message.co_model_* fields
   *  - (optionally) apply security rules on the co-model alias
   */
  override createSecurityRuleAwareQueryBuilder(
    alias = 'detail',
    queryRunner?: QueryRunner,
  ): SelectQueryBuilder<ChatterMessageDetails> {
    const activeUser = this.requestContextService.getActiveUser();
    let qb = super.createSecurityRuleAwareQueryBuilder(alias, queryRunner);
    if (!activeUser) return qb;

    // Example: join the "client" co-model (pass whatever co-model name you need)
    const [coModelName, coModelAlias] = this.getCoModelNameAndAlias();
    if (!coModelName) return qb;

    // Join the real relation so we can access co_model_* fields
    qb = qb.leftJoin(`${alias}.chatterMessage`, 'chatterMessage');
    qb = this.leftJoinCoModel(qb, coModelName, 'chatterMessage');

    // If your security rules should apply to the co-model rows, pass the co-model alias.
    // Here we use the co-model name "client" both as model key and alias base for consistency.
    return this.securityRuleRepository.applySecurityRules(
      qb,
      coModelName,                           // modelSingularName (or whatever your rules expect)
      activeUser as ActiveUserData,
      coModelAlias,      // the alias we used inside leftJoinCoModel
    );
  }

  /**
   * Left-join the polymorphic co-model table, matching:
   *   <coModelAlias>.id = <messageAlias>.co_model_entity_id
   *   AND <messageAlias>.co_model_name = :model
   *
   * @param qb            QB built on ChatterMessageDetails
   * @param coModelName   e.g. "client" | "invoice" | ...
   * @param messageAlias  alias used for joined ChatterMessage (default: "message")
   *
   * Notes:
   * - We resolve the entity metadata from the classified name (e.g., "Client"),
   *   then use metadata.tablePath to get schema-qualified table.
   * - We build a stable alias from metadata.name (camelized).
   */
  leftJoinCoModel<T>(
    qb: SelectQueryBuilder<T>,
    coModelName: string,
    messageAlias: string = 'message',
  ): SelectQueryBuilder<T> {
    // Resolve entity metadata from your naming convention
    const entityName = classify(coModelName);                 // "client" -> "Client"
    const meta = this.dataSource.getMetadata(entityName);     // throws if not registered
    // const table = meta.tablePath;                             // schema-qualified
    const coAlias = camelize(meta.name);                      // stable alias, e.g., "client"

    // LEFT JOIN "<schema>"."<table>" "<coAlias>"
    //   ON "<coAlias>"."id" = "message"."co_model_entity_id"
    //  AND "message"."co_model_name" = :model
    qb.leftJoin(
      entityName,
      coAlias,
      `"${coAlias}"."id" = "${messageAlias}"."co_model_entity_id" AND "${messageAlias}"."co_model_name" = :model`,
      { model: coModelName },
    );

    return qb;
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