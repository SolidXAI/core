import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, EntitySubscriberInterface, EventSubscriber, RecoverEvent, SoftRemoveEvent } from "typeorm";


@EventSubscriber()
@Injectable()
export class SoftDeleteAwareEventSubscriber implements EntitySubscriberInterface {
    private readonly logger = new Logger(SoftDeleteAwareEventSubscriber.name);
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
    ) {
        this.dataSource.subscribers.push(this);
    }

    beforeSoftRemove(event: SoftRemoveEvent<any>): Promise<any> | void {
        if (!event.entity) return;
        const entity = event.entity;
        // Update trackerDate if deletedAt is not already set
        if (!entity.deletedAt) {
            entity.deletedTracker = `${new Date()}`; // Set trackerDate to the current date
        } else {
            entity.deletedTracker = `${entity.deletedAt}`; // Set trackerDate to the deleted Date
        }
        // console.log('TrackerDate updated:', entity.trackerDate);
        this.logger.debug(`TrackerDate updated: ${entity.trackerDate}`);

    }

    beforeRecover(event: RecoverEvent<any>): Promise<any> | void {
        if (!event.entity) return;
        const entity = event.entity;
        entity.deletedTracker = "not-deleted"; // Set trackerDate to the current date
    }

}