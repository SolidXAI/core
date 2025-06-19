import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FieldMetadata } from 'src/entities/field-metadata.entity';
import { DataSource, Repository } from 'typeorm';

/**
 * @deprecated Use `FieldMetadataRepository` instead.
 */
@Injectable()
export class FieldRepository extends Repository<FieldMetadata> {
    constructor(
        private dataSource: DataSource,
        @InjectRepository(FieldMetadata)
        private readonly fieldMetadataRepo: Repository<FieldMetadata>,

    ) {
        super(FieldMetadata, dataSource.createEntityManager());
    }

    async findFieldMetadata(fieldName: string, modelName: string) {
        const fileMediaField = await this.fieldMetadataRepo.findOne({
            where: {
              name: fieldName,
              model: {
                singularName: modelName
              },
            },
            relations: ['model', 'mediaStorageProvider'],
          });
          return fileMediaField;
    }

}
