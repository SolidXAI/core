import { Injectable } from '@nestjs/common';
import { SecurityRuleRepository } from 'src';
import { SolidFieldType } from 'src/dtos/create-field-metadata.dto';
import { FieldMetadata } from 'src/entities/field-metadata.entity';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class FieldMetadataRepository extends SolidBaseRepository<FieldMetadata> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(FieldMetadata, dataSource, requestContextService, securityRuleRepository);
    }

    async findComputedFieldsPopulatedWithModelAndModule() {
        const computedFields = await this.find({
            where: {
                type: SolidFieldType.computed,
            },
            relations: ['model', 'model.module'],
        });

        return computedFields;
    }

}