import { DataSource, EntitySubscriberInterface, InsertEvent } from 'typeorm';
import { ModelMetadata } from '../entities/model-metadata.entity';
export declare class ModelSubscriber implements EntitySubscriberInterface<ModelMetadata> {
    private readonly dataSource;
    private readonly logger;
    constructor(dataSource: DataSource);
    listenTo(): typeof ModelMetadata;
    afterInsert(event: InsertEvent<ModelMetadata>): Promise<void>;
}
