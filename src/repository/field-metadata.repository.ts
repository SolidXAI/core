import { Injectable } from '@nestjs/common';
import { SolidFieldType } from 'src/dtos/create-field-metadata.dto';
import { FieldMetadata } from 'src/entities/field-metadata.entity';
import { DataSource } from 'typeorm';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class FieldMetadataRepository extends SolidBaseRepository<FieldMetadata> {
    constructor(
        readonly dataSource: DataSource,
        // readonly requestContextService: RequestContextService,
        // readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(FieldMetadata, dataSource, null, null);
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