import { Repository, DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { FieldMetadata } from 'src/entities/field-metadata.entity';
import { InjectRepository } from '@nestjs/typeorm';

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
