import { DataSource, EntitySubscriberInterface, RecoverEvent, SoftRemoveEvent } from "typeorm";
export declare class SoftDeleteAwareEventSubscriber implements EntitySubscriberInterface {
    private readonly dataSource;
    private readonly logger;
    constructor(dataSource: DataSource);
    beforeSoftRemove(event: SoftRemoveEvent<any>): Promise<any> | void;
    beforeRecover(event: RecoverEvent<any>): Promise<any> | void;
}
