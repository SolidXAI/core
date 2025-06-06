import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ModelMetadataHelperService } from 'src/helpers/model-metadata-helper.service';
import { DataSource, EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from 'typeorm';
import { FieldMetadata } from '../entities/field-metadata.entity';

@EventSubscriber()
@Injectable()
export class FieldMetadataSubscriber implements EntitySubscriberInterface<FieldMetadata> {
  private readonly logger = new Logger(FieldMetadataSubscriber.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {
    this.dataSource.subscribers.push(this);
  }

  listenTo() {
    return FieldMetadata;
  }

  async afterUpdate(event: UpdateEvent<FieldMetadata>): Promise<void> {
    // If a field of type relation.many-to-one is marked for removal, and this field had an inverse relation created 
    // It means there is a field of type relation.one-to-many in the co-model, which needs to be removed
    if (event.entity && event.entity.isMarkedForRemoval && event.entity.type === 'relation' && event.entity.relationType === 'many-to-one' && event.entity.relationCreateInverse === true) {
      const relationCoModelSingularName = event.entity.relationCoModelSingularName;
      const relationCoModelFieldName = event.entity.relationCoModelFieldName;

      // Find the above field and mark it for removal.
    }
  }
}
