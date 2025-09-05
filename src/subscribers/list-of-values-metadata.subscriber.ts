import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from "@nestjs/typeorm";
import { ListOfValues } from 'src/entities/list-of-values.entity';
import { ModuleMetadataHelperService } from "src/helpers/module-metadata-helper.service";
import { ListOfValuesMetadataService } from 'src/services/list-of-values-metadata.service';
import { DataSource, EntityManager, EntitySubscriberInterface, InsertEvent, RemoveEvent, UpdateEvent } from "typeorm";

@Injectable()
export class ListOfValuesMetadataSubscriber implements EntitySubscriberInterface<ListOfValues> {
    private readonly logger = new Logger(this.constructor.name);
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
        readonly moduleMetadataHelperService: ModuleMetadataHelperService,
        readonly listOfValuesMetadataService: ListOfValuesMetadataService, // Assuming you have a DashboardService for custom queries
    ) {
        this.dataSource.subscribers.push(this);
    }

    listenTo() {
        return ListOfValues;
    }

    async afterInsert(event: InsertEvent<ListOfValues>) {
        if (!event.entity) {
            this.logger.debug('No listofvalue entity found in the ListofValueSubscriber afterInsert method');
            return;
        }
        // await this.saveListOfValuesToConfig(event.entity, event.queryRunner.manager);
    }

    async afterUpdate(event: UpdateEvent<ListOfValues>) {
        if (!event.entity) {
            this.logger.debug('No listofvalue entity found in the ListofValueSubscriber afterInsert method');
            return;
        }

        //@ts-ignore
        // await this.updateListOfValuesToConfig(event.databaseEntity, event.entity, event.queryRunner.manager);
    }


    private async saveListOfValuesToConfig(listOfValues: ListOfValues, entityManager: EntityManager): Promise<void> {
        if (!listOfValues || !listOfValues.id) {
            this.logger.debug('Listofvalue id is undefined');
            return;
        }

        // Load the Listofvalue with module relation populated
        const populatedLov = await entityManager.findOne(ListOfValues, {
            where: { id: listOfValues.id },
            relations: ['module'],
        });

        if (!populatedLov) {
            this.logger.error(`Listofvalue not found for id ${listOfValues.id}`);
            return;
        }

        // Call the saveListofValuesToConfig method from the ListOfValuesMetadataService
        await this.listOfValuesMetadataService.saveListofValuesToConfig(populatedLov);
    }

    private async updateListOfValuesToConfig(oldlistOfValues: ListOfValues, listOfValues: ListOfValues, entityManager: EntityManager): Promise<void> {
        if (!listOfValues || !listOfValues.id) {
            this.logger.debug('Listofvalue id is undefined');
            return;
        }

        // Load the Listofvalue with module relation populated
        const populatedLov = await entityManager.findOne(ListOfValues, {
            where: { id: listOfValues.id },
            relations: ['module'],
        });

        if (!populatedLov) {
            this.logger.error(`Listofvalue not found for id ${listOfValues.id}`);
            return;
        }

        // Call the updateListofValuesToConfig method from the ListOfValuesMetadataService
        await this.listOfValuesMetadataService.updateListofValuesToConfig(oldlistOfValues, populatedLov);
    }

}