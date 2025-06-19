import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from "typeorm";

@Injectable()
@EventSubscriber()
export class ComputedEntityFieldSubscriber implements EntitySubscriberInterface {
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
    ) {
        this.dataSource.subscribers.push(this);
    }

    async beforeInsert(event: InsertEvent<any>) {
    }

    async beforeUpdate(event: UpdateEvent<any>) {
    }
    
}