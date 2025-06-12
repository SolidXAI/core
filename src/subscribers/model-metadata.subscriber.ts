import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ModelMetadataHelperService } from 'src/helpers/model-metadata-helper.service';
import { DataSource, EntitySubscriberInterface, EventSubscriber, InsertEvent } from 'typeorm';
import { FieldMetadata } from '../entities/field-metadata.entity';
import { ModelMetadata } from '../entities/model-metadata.entity';

@EventSubscriber()
@Injectable()
export class ModelMetadataSubscriber implements EntitySubscriberInterface<ModelMetadata> {
  private readonly logger = new Logger(ModelMetadataSubscriber.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly modelHelperService: ModelMetadataHelperService,
  ) {
    this.dataSource.subscribers.push(this);
  }

  listenTo() {
    return ModelMetadata;
  }

  async afterInsert(event: InsertEvent<ModelMetadata>): Promise<void> {
    this.logger.debug(`[ModelSubscriber] getting invoked for insert on model: ${event.entity.singularName}`);

    const transactionManager = event.queryRunner?.manager;
    if (!transactionManager) {
      throw new NotFoundException(`Trnasaction Manager not found`);
    }

    await transactionManager.save(FieldMetadata, this.systemFieldMetadataToBeAdded(event));
  }


  private systemFieldMetadataToBeAdded(event: InsertEvent<ModelMetadata>) {
    const systemFieldsDefaultMetadata = this.modelHelperService.getSystemFieldsMetadata();
    // map and add the model as event.entity for the above metadata
    const systemFieldsMetadata = systemFieldsDefaultMetadata.map(field => ({
      ...field,
      model: event.entity,
    }));
    return systemFieldsMetadata;
  }
}
