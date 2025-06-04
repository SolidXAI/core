import { DataSource, EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from 'typeorm';
import { ModelMetadata } from '../entities/model-metadata.entity';
import { FieldMetadata } from '../entities/field-metadata.entity';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { RemoveFieldsCommand } from '../commands/remove-fields.command';

@EventSubscriber()
@Injectable()
export class ModelSubscriber implements EntitySubscriberInterface<ModelMetadata> {
  private readonly logger = new Logger(ModelSubscriber.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,

  ) {
    this.dataSource.subscribers.push(this);
  }

  listenTo() {
    return ModelMetadata;
  }

  async afterInsert(event: InsertEvent<ModelMetadata>): Promise<void> {
    this.logger.debug(`[ModelSubscriber] getting invoked for insert on model: ${event.entity.singularName}`);

    // const fieldMetadataRepo = event.manager.getRepository(FieldMetadata);
    // const fieldMetadataRepo = this.dataSource.getRepository(FieldMetadata);
    const transactionManager = event.queryRunner?.manager;
    if (!transactionManager) {
      throw new NotFoundException(`Trnasaction Manager not found`);

    }

    const systemFieldsMetadata = [
      {
        name: "id",
        displayName: "Id",
        type: "int",
        ormType: "bigint",
        isSystem: true,
        model: event.entity,
      },
      {
        name: "createdAt",
        displayName: "Created At",
        type: "datetime",
        ormType: "timestamp",
        isSystem: true,
        model: event.entity,
      },
      {
        name: "updatedAt",
        displayName: "Updated At",
        type: "datetime",
        ormType: "timestamp",
        isSystem: true,
        model: event.entity,
      },
      {
        name: "deletedAt",
        displayName: "Deleted At",
        type: "datetime",
        ormType: "timestamp",
        isSystem: true,
        model: event.entity,
      },
      {
        name: "publishedAt",
        displayName: "Published At",
        type: "datetime",
        ormType: "timestamp",
        isSystem: true,
        model: event.entity,
      },
      {
        name: "localeName",
        displayName: "Locale",
        type: "shortText",
        ormType: "varchar",
        isSystem: true,
        model: event.entity,
      },
      {
        name: "defaultEntityLocaleId",
        displayName: "Default Entity Locale Id",
        type: "int",
        ormType: "integer",
        isSystem: true,
        model: event.entity,
      }
    ];
    await transactionManager.save(FieldMetadata, systemFieldsMetadata);
    // Save to the database.
    // fieldMetadataRepo.save(systemFieldsMetadata);

  }

}
