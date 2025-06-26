import { Injectable, Logger } from '@nestjs/common';
import { SolidFieldType } from 'src/dtos/create-field-metadata.dto';
import { FieldMetadata } from 'src/entities/field-metadata.entity';
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class FieldMetadataRepository extends Repository<FieldMetadata> {
    private readonly logger = new Logger(FieldMetadataRepository.name);
    constructor(
        dataSource: DataSource,
    ) {
        super(FieldMetadata, dataSource.createEntityManager());
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